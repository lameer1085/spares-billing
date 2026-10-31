import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, IconButton, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { api, errorMessage } from '../../api/client'
import type { Customer, Product, QuotationFull, StateItem } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useLiveProducts } from '../../hooks/useLiveProducts'
import { usePersistentState } from '../../hooks/usePersistentState'
import { todayIST } from '../../utils/dates'
import { splitServerMessage } from '../../utils/formErrors'
import CustomerPicker from '../billing/CustomerPicker'
import ProductSearch from '../billing/ProductSearch'
import { DEFAULT_TERMS, loadDefaultTerms, saveDefaultTerms } from './quotationDefaults'
import { calcLine, calcTotals, rs, type QLine } from './quotationCalc'

// basePrice = the price the part had when the line was added. While the line still shows that price,
// it follows the part when you edit it in Products. A price you typed yourself is never overwritten.
type QL = QLine & { basePrice?: string }

interface QDraft {
  customer: Customer | null
  buyerName: string
  buyerAddress: string
  buyerGstin: string
  buyerPhone: string
  pos: string
  date: string
  validityDays: string
  lines: QL[]
  terms: string
  notes: string
}

const makeEmpty = (): QDraft => ({
  customer: null, buyerName: '', buyerAddress: '', buyerGstin: '', buyerPhone: '', pos: '',
  date: todayIST(), validityDays: '15', lines: [], terms: loadDefaultTerms(), notes: '',
})

type FieldKey = 'buyerName' | 'buyerGstin' | 'buyerPhone' | 'placeOfSupplyState'
const FIELDS: FieldKey[] = ['buyerName', 'buyerGstin', 'buyerPhone', 'placeOfSupplyState']
const KEYWORDS: [RegExp, FieldKey][] = [
  [/gstin/i, 'buyerGstin'], [/place of supply/i, 'placeOfSupplyState'], [/phone/i, 'buyerPhone'],
]

const newKey = () => Math.random().toString(36).slice(2)
const exGst = (p: Product) => Math.round(((p.sellingPrice * 100) / (100 + p.gstRate)) * 100) / 100
// the quotation starts at the list price; parts without one use the selling price less GST
const quotePrice = (p: Product) => (p.listPrice ?? exGst(p)).toFixed(2)

function fromQuotation(q: QuotationFull, asEdit: boolean): QDraft {
  const days = Math.max(1, Math.round((Date.parse(q.validUntil) - Date.parse(q.quotationDate)) / 86400000))
  return {
    customer: null,
    buyerName: q.buyerName,
    buyerAddress: q.buyerAddress ?? '',
    buyerGstin: q.buyerGstin ?? '',
    buyerPhone: q.buyerPhone ?? '',
    pos: q.placeOfSupply,
    date: asEdit ? q.quotationDate : todayIST(),
    validityDays: String(days),
    lines: q.items.map((i) => ({
      key: newKey(), productId: i.productId, partNumber: i.partNumber ?? '', description: i.description,
      hsnCode: i.hsnCode ?? '', qty: String(i.quantity), unit: i.unit, price: String(i.unitPrice),
      discount: String(i.discountPercent), gst: String(i.gstRate), purchasePrice: null,
    })),
    terms: q.terms ?? '',
    notes: q.notes ?? '',
  }
}

export default function QuotationFormPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : null
  const [params] = useSearchParams()
  const fromId = params.get('from') ? Number(params.get('from')) : null
  const loadId = editId ?? fromId
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isOwner } = useAuth()

  // New quotations are kept as a draft in the browser. Edits are not.
  const [d, setD, clearDraft] = usePersistentState<QDraft>('spares_quotation_draft', makeEmpty(), editId === null)
  const upd = (patch: Partial<QDraft>) => setD((p) => ({ ...p, ...patch }))

  const [touched, setTouched] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [general, setGeneral] = useState<string[]>([])
  const [allDiscount, setAllDiscount] = useState('')
  const [termsSaved, setTermsSaved] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const shop = useQuery({
    queryKey: ['shop'],
    queryFn: async () => (await api.get('/shop')).data as { stateCode?: string | null; shopName?: string },
  })
  const states = useQuery({
    queryKey: ['states'], staleTime: Infinity,
    queryFn: async () => (await api.get<StateItem[]>('/states')).data,
  })
  const existing = useQuery({
    queryKey: ['quotation', loadId],
    enabled: loadId !== null,
    queryFn: async () => (await api.get<QuotationFull>(`/quotations/${loadId}`)).data,
  })

  // Default place of supply = the shop's own state
  useEffect(() => {
    if (!d.pos && shop.data?.stateCode && loadId === null) upd({ pos: shop.data.stateCode })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.data])

  // Load an existing quotation (edit) or a copy of one (duplicate)
  const loaded = useRef(false)
  useEffect(() => {
    const q = existing.data
    if (!q || loaded.current) return
    loaded.current = true
    setD({ ...fromQuotation(q, editId !== null), terms: q.terms ?? loadDefaultTerms() })
    if (q.customerId) {
      api.get<Customer>(`/customers/${q.customerId}`).then((r) => setD((p) => ({ ...p, customer: r.data }))).catch(() => {})
    }
    if (isOwner) {
      const ids = [...new Set(q.items.map((i) => i.productId).filter((x): x is number => x != null))]
      Promise.all(ids.map((pid) => api.get<Product>(`/products/${pid}`).then((r) => [pid, r.data.purchasePrice] as const)))
        .then((pairs) => {
          const m = new Map(pairs)
          setD((p) => ({ ...p, lines: p.lines.map((l) => (l.productId != null ? { ...l, purchasePrice: m.get(l.productId) ?? null } : l)) }))
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data])

  const intra = d.pos !== '' && d.pos === shop.data?.stateCode
  const totals = calcTotals(d.lines, intra)
  const posName = states.data?.find((s) => s.code === d.pos)?.name

  // ---------- lines ----------
  const addProduct = (p: Product) => {
    const line: QL = {
      key: newKey(), productId: p.id, partNumber: p.partNumber, description: p.name, hsnCode: p.hsnCode ?? '',
      qty: '1', unit: 'NOS', price: quotePrice(p), basePrice: quotePrice(p), discount: allDiscount,
      gst: String(p.gstRate), purchasePrice: p.purchasePrice,
    }
    setD((prev) => ({ ...prev, lines: [...prev.lines, line] }))
    setTimeout(() => { const el = qtyRefs.current[line.key]; el?.focus(); el?.select() }, 60)
  }
  const addCustomLine = () => {
    const line: QL = {
      key: newKey(), productId: null, partNumber: '', description: '', hsnCode: '', qty: '1', unit: 'NOS',
      price: '', discount: allDiscount, gst: '18', purchasePrice: null,
    }
    setD((prev) => ({ ...prev, lines: [...prev.lines, line] }))
  }
  const updateLine = (key: string, patch: Partial<QL>) =>
    setD((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))
  const removeLine = (key: string) => {
    setD((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.key !== key) }))
    searchRef.current?.focus()
  }
  // A part was edited in Products after it was added here: lines you have not changed take the new
  // price, GST and HSN. Your own typed prices stay. The cost (owner only) is always refreshed.
  useLiveProducts(d.lines.flatMap((l) => (l.productId != null ? [l.productId] : [])), (fresh) =>
    setD((prev) => {
      let changed = false
      const lines = prev.lines.map((l) => {
        const p = fresh.find((x) => x.id === l.productId)
        if (!p) return l
        const next: QL = { ...l }
        if (isOwner) next.purchasePrice = p.purchasePrice
        const price = quotePrice(p)
        if (l.basePrice !== undefined && l.price === l.basePrice && l.basePrice !== price) {
          next.price = price
          next.basePrice = price
          next.gst = String(p.gstRate)
          next.hsnCode = p.hsnCode ?? ''
        }
        if (next.purchasePrice !== l.purchasePrice || next.price !== l.price || next.gst !== l.gst || next.hsnCode !== l.hsnCode) {
          changed = true
          return next
        }
        return l
      })
      return changed ? { ...prev, lines } : prev
    }))

  const applyAll = () => {
    if (allDiscount === '' || Number(allDiscount) < 0 || Number(allDiscount) > 100) return
    setD((prev) => ({ ...prev, lines: prev.lines.map((l) => ({ ...l, discount: allDiscount })) }))
  }

  // ---------- validation ----------
  const lineProblems = d.lines.flatMap((l, i) => {
    const out: string[] = []
    const n = `Line ${i + 1}`
    if (!l.description.trim()) out.push(`${n}: description is required`)
    if (!Number.isInteger(Number(l.qty)) || Number(l.qty) < 1) out.push(`${n}: quantity must be a whole number, 1 or more`)
    if (l.price === '' || Number(l.price) < 0) out.push(`${n}: enter the price`)
    if (Number(l.discount || 0) < 0 || Number(l.discount || 0) > 100) out.push(`${n}: discount must be 0 to 100`)
    if (l.gst === '' || Number(l.gst) < 0 || Number(l.gst) > 40) out.push(`${n}: GST must be 0 to 40`)
    return out
  })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        customerId: d.customer?.id ?? null,
        buyerName: d.buyerName.trim(),
        buyerAddress: d.buyerAddress.trim() || null,
        buyerGstin: d.buyerGstin.trim().toUpperCase() || null,
        buyerPhone: d.buyerPhone.trim() || null,
        placeOfSupplyState: d.pos,
        quotationDate: d.date,
        validityDays: Number(d.validityDays) || 15,
        items: d.lines.map((l) => ({
          productId: l.productId,
          partNumber: l.partNumber.trim() || null,
          description: l.description.trim(),
          hsnCode: l.hsnCode.trim() || null,
          quantity: Number(l.qty),
          unit: l.unit.trim() || 'NOS',
          unitPrice: Number(l.price),
          discountPercent: Number(l.discount) || 0,
          gstRate: Number(l.gst),
        })),
        terms: d.terms.trim() || null,
        notes: d.notes.trim() || null,
      }
      return editId
        ? (await api.put<QuotationFull>(`/quotations/${editId}`, body)).data
        : (await api.post<QuotationFull>('/quotations', body)).data
    },
    onSuccess: (q) => {
      if (editId === null) clearDraft()
      qc.invalidateQueries({ queryKey: ['quotations'] })
      qc.invalidateQueries({ queryKey: ['quotation', q.id] })
      navigate(`/quotations?open=${q.id}`)
    },
    onError: (e) => {
      const r = splitServerMessage(errorMessage(e), FIELDS, KEYWORDS)
      setErrors(r.errors)
      setGeneral(r.general)
    },
  })

  const submit = () => {
    setTouched(true)
    setGeneral([])
    const e: Partial<Record<FieldKey, string>> = {}
    if (!d.buyerName.trim()) e.buyerName = 'Buyer name is required'
    if (!d.pos) e.placeOfSupplyState = 'Choose the state'
    if (d.buyerGstin.trim() && d.buyerGstin.trim().length !== 15) e.buyerGstin = 'GSTIN must be 15 characters'
    setErrors(e)
    if (Object.keys(e).length > 0 || d.lines.length === 0 || lineProblems.length > 0) return
    save.mutate()
  }

  const pickCustomer = (c: Customer | null) => {
    if (!c) { upd({ customer: null }); return }
    upd({
      customer: c, buyerName: c.name, buyerAddress: c.address ?? '', buyerGstin: c.gstin ?? '',
      buyerPhone: c.phone ?? '', pos: c.stateCode ?? d.pos,
    })
    setErrors({})
  }

  const clearField = (k: FieldKey) => { if (errors[k]) setErrors({ ...errors, [k]: undefined }) }
  const cell = { size: 'small' as const, variant: 'outlined' as const }
  const num = (extra?: object) => ({ htmlInput: { style: { textAlign: 'right' as const, padding: '6px 8px' }, ...extra } })

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {editId ? `Edit quotation ${existing.data?.quotationNo ?? ''}` : fromId ? 'New quotation (copy)' : 'New quotation'}
        </Typography>
        <Button onClick={() => navigate('/quotations')}>Back to quotations</Button>
      </Box>
      {loadId !== null && existing.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(existing.error)}</Alert>}

      {/* BUYER AND TERMS OF SUPPLY */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <Box sx={{ gridColumn: { md: '1 / 3' } }}>
            <CustomerPicker label="Pick a saved customer (optional)" value={d.customer} onChange={pickCustomer} />
          </Box>
          <TextField label="Buyer name" required value={d.buyerName}
            onChange={(e) => { upd({ buyerName: e.target.value }); clearField('buyerName') }}
            error={!!errors.buyerName} helperText={errors.buyerName} sx={{ gridColumn: { md: '3 / 5' } }} />
          <TextField label="Buyer address" multiline minRows={2} value={d.buyerAddress}
            onChange={(e) => upd({ buyerAddress: e.target.value })} sx={{ gridColumn: { md: '1 / 3' } }} />
          <TextField label="Buyer GSTIN (optional)" value={d.buyerGstin}
            onChange={(e) => { upd({ buyerGstin: e.target.value }); clearField('buyerGstin') }}
            error={!!errors.buyerGstin} helperText={errors.buyerGstin} />
          <TextField label="Buyer phone" value={d.buyerPhone}
            onChange={(e) => { upd({ buyerPhone: e.target.value }); clearField('buyerPhone') }}
            error={!!errors.buyerPhone} helperText={errors.buyerPhone} />

          <TextField select label="Place of supply (state)" required value={d.pos}
            onChange={(e) => { upd({ pos: e.target.value }); clearField('placeOfSupplyState') }}
            error={!!errors.placeOfSupplyState}
            helperText={errors.placeOfSupplyState ?? (d.pos
              ? (intra ? 'Same state: CGST + SGST' : `Another state (${posName ?? d.pos}): IGST`)
              : 'Where the goods are going')}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            sx={{ gridColumn: { md: '1 / 3' } }}>
            <MenuItem value="">Choose…</MenuItem>
            {states.data?.map((s) => <MenuItem key={s.code} value={s.code}>{s.code} · {s.name}</MenuItem>)}
          </TextField>
          <TextField label="Quotation date" type="date" value={d.date}
            onChange={(e) => upd({ date: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Valid for (days)" type="number" value={d.validityDays}
            onChange={(e) => upd({ validityDays: e.target.value })} />
        </Box>
      </Paper>

      {/* ADD ITEMS */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ flexGrow: 1, minWidth: 300 }}>
          <ProductSearch onPick={addProduct} inputRef={searchRef} />
        </Box>
        <Button onClick={addCustomLine}>Add custom line</Button>
        <TextField size="small" type="number" label="Discount % for all lines" value={allDiscount}
          onChange={(e) => setAllDiscount(e.target.value)} sx={{ width: 190 }} />
        <Button variant="outlined" onClick={applyAll} disabled={allDiscount === '' || d.lines.length === 0}>
          Apply to all
        </Button>
      </Paper>

      {/* ITEMS */}
      {/* only this box scrolls, so the search box above stays in view */}
      <Paper sx={{ mb: 2, overflow: 'auto', maxHeight: 'calc(100vh - 260px)', minHeight: 260 }}>
        <Table stickyHeader size="small" sx={{ minWidth: 1250 }}>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Part</TableCell>
              <TableCell>HSN</TableCell>
              <TableCell align="right" sx={{ width: 100 }}>Qty</TableCell>
              <TableCell sx={{ width: 80 }}>Unit</TableCell>
              <TableCell align="right" sx={{ width: 150 }}>Price (excl. GST)</TableCell>
              <TableCell align="right" sx={{ width: 100 }}>Disc %</TableCell>
              <TableCell align="right" sx={{ width: 95 }}>GST %</TableCell>
              <TableCell align="right">Taxable</TableCell>
              <TableCell align="right">Line total</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {d.lines.map((l, i) => {
              const t = calcLine(l, intra)
              const margin = t.costC != null && t.taxableC > 0 ? ((t.taxableC - t.costC) / t.taxableC) * 100 : null
              return (
                <TableRow key={l.key}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>
                    <TextField {...cell} fullWidth placeholder="Part number" value={l.partNumber}
                      onChange={(e) => updateLine(l.key, { partNumber: e.target.value })} sx={{ mb: 0.5 }} />
                    <TextField {...cell} fullWidth placeholder="Description" value={l.description}
                      error={touched && !l.description.trim()}
                      onChange={(e) => updateLine(l.key, { description: e.target.value })} />
                    {isOwner && margin != null && (
                      <Typography variant="caption" color={margin < 0 ? 'error' : 'text.secondary'}>
                        Cost {rs(Math.round((l.purchasePrice ?? 0) * 100))} each · margin {margin.toFixed(1)}%
                        {margin < 0 ? ' (below cost)' : ''}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <TextField {...cell} value={l.hsnCode} onChange={(e) => updateLine(l.key, { hsnCode: e.target.value })}
                      sx={{ width: 120 }} />
                  </TableCell>
                  <TableCell align="right">
                    <TextField {...cell} type="number" value={l.qty}
                      error={!Number.isInteger(Number(l.qty)) || Number(l.qty) < 1}
                      inputRef={(el) => { qtyRefs.current[l.key] = el }}
                      onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchRef.current?.focus() } }}
                      slotProps={num({ min: 1 })} />
                  </TableCell>
                  <TableCell>
                    <TextField {...cell} value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} />
                  </TableCell>
                  <TableCell align="right">
                    <TextField {...cell} type="number" value={l.price} error={l.price === ''}
                      onChange={(e) => updateLine(l.key, { price: e.target.value })} slotProps={num({ min: 0 })} />
                  </TableCell>
                  <TableCell align="right">
                    <TextField {...cell} type="number" value={l.discount}
                      onChange={(e) => updateLine(l.key, { discount: e.target.value })}
                      slotProps={num({ min: 0, max: 100 })} />
                  </TableCell>
                  <TableCell align="right">
                    <TextField {...cell} type="number" value={l.gst}
                      onChange={(e) => updateLine(l.key, { gst: e.target.value })} slotProps={num({ min: 0, max: 40 })} />
                  </TableCell>
                  <TableCell align="right">{rs(t.taxableC)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{rs(t.totalC)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => removeLine(l.key)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
            {d.lines.length === 0 && (
              <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                No items yet. Search for a part above and press Enter, or add a custom line.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* TERMS, NOTES AND TOTALS */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 340px' }, gap: 2, alignItems: 'start' }}>
        <Paper sx={{ p: 2, display: 'grid', gap: 2 }}>
          <TextField label="Terms and conditions (printed at the bottom, with your bank details)" multiline minRows={8}
            value={d.terms} onChange={(e) => { upd({ terms: e.target.value }); setTermsSaved(false) }} />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button size="small" onClick={() => { saveDefaultTerms(d.terms); setTermsSaved(true) }}>
              Save as my default terms
            </Button>
            <Button size="small" color="inherit" onClick={() => upd({ terms: DEFAULT_TERMS })}>Use the standard text</Button>
            {termsSaved && <Chip size="small" color="success" label="Saved on this computer" />}
          </Box>
          <TextField label="Notes (optional)" multiline minRows={2} value={d.notes}
            onChange={(e) => upd({ notes: e.target.value })} />
        </Paper>

        <Box sx={{ display: 'grid', gap: 2 }}>
          <Paper sx={{ p: 2 }}>
            <Row label="Total value" value={rs(totals.grossC)} />
            <Row label="Less: discount" value={`− ${rs(totals.discC)}`} />
            <Row label="Total before tax" value={rs(totals.taxableC)} bold />
            {intra ? (
              <>
                <Row label="CGST" value={rs(totals.cgstC)} />
                <Row label="SGST" value={rs(totals.sgstC)} />
              </>
            ) : (
              <Row label="IGST" value={rs(totals.igstC)} />
            )}
            <Row label="Round off" value={rs(totals.roundOffC)} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, alignItems: 'baseline' }}>
              <Typography variant="h6">Total after tax</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{rs(totals.grandC)}</Typography>
            </Box>
            {isOwner && totals.costKnown > 0 && (
              <Box sx={{ mt: 2 }}>
                <Chip color={totals.profitC >= 0 ? 'success' : 'error'} variant="outlined"
                  label={`Your profit ${rs(totals.profitC)}${totals.taxableC > 0
                    ? ` (${((totals.profitC / totals.taxableC) * 100).toFixed(1)}%)` : ''}`} />
                {totals.costKnown < d.lines.length && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Based on {totals.costKnown} of {d.lines.length} lines (custom lines have no cost)
                  </Typography>
                )}
              </Box>
            )}
          </Paper>

          {touched && d.lines.length === 0 && <Alert severity="error">Add at least one item.</Alert>}
          {touched && lineProblems.length > 0 && <Alert severity="error">{lineProblems.join('. ')}</Alert>}
          {general.length > 0 && <Alert severity="error" onClose={() => setGeneral([])}>{general.join('. ')}</Alert>}

          <Button variant="contained" size="large" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : editId ? 'Save changes' : 'Save quotation'}
          </Button>
          {editId === null && (
            <Button color="inherit" disabled={save.isPending || (d.lines.length === 0 && !d.buyerName)}
              onClick={() => { clearDraft(); setTouched(false); setErrors({}); setGeneral([]) }}>
              Clear
            </Button>
          )}
        </Box>
      </Box>
    </>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography color="text.secondary" sx={{ fontWeight: bold ? 700 : 400 }}>{label}</Typography>
      <Typography sx={{ fontWeight: bold ? 700 : 400 }}>{value}</Typography>
    </Box>
  )
}