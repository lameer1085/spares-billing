import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { api, errorMessage } from '../../api/client'
import { inr, type PayMethod, type Product, type PurchaseFull, type Supplier } from '../../api/types'
import { usePersistentState } from '../../hooks/usePersistentState'
import { useLiveProducts } from '../../hooks/useLiveProducts'
import ProductSearch from '../billing/ProductSearch'
import SupplierPicker from './SupplierPicker'
import ImportBillDialog, { type ImportedRow } from './ImportBillDialog'

// list = the supplier's price list rate (excl. GST). disc = your discount from it.
// unitCost = what you pay the supplier (excl. GST). sell = what Billing will charge (incl. GST).
// dirty = you typed a price on this line yourself, so it is no longer refreshed from the product.
// (A line from an older saved draft has no dirty value, and is treated as typed.)
interface PLine {
  product: Product; qty: string; list: string; disc: string; unitCost: string; gst: string; sell: string; dirty?: boolean
}
interface Draft {
  supplier: Supplier | null
  invoiceNo: string
  date: string
  lines: PLine[]
  paid: string
  method: PayMethod
  notes: string
  updatePrice: boolean
}

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const makeEmpty = (): Draft => ({
  supplier: null, invoiceNo: '', date: todayIST(), lines: [], paid: '', method: 'CASH', notes: '', updatePrice: true,
})
const cents = (n: number) => Math.round(n * 100)
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const str = (n: number) => String(r2(n))

// cost = list less discount; selling = list plus GST; discount = how far cost is below list
const costFrom = (list: string, disc: string) =>
  list !== '' && Number(list) >= 0 ? str(Number(list) * (1 - (Number(disc) || 0) / 100)) : ''
const sellFrom = (list: string, gst: string) =>
  list !== '' && Number(list) >= 0 ? str(Number(list) * (1 + (Number(gst) || 0) / 100)) : ''
const discFrom = (list: string, cost: string) =>
  list !== '' && Number(list) > 0 && cost !== '' ? str((1 - Number(cost) / Number(list)) * 100) : ''

// drafts saved by older versions have no list / disc / sell, so fall back safely
const listOf = (l: PLine) => l.list ?? ''
const discOf = (l: PLine) => l.disc ?? ''
const sellOf = (l: PLine) => l.sell ?? String(l.product.sellingPrice ?? '')
const costWithGst = (l: PLine) => (Number(l.unitCost) || 0) * (1 + (Number(l.gst) || 0) / 100)
const belowCost = (l: PLine) => {
  const s = Number(sellOf(l))
  return s > 0 && s < costWithGst(l) - 0.005
}

const freshLine = (p: Product): PLine => {
  const list = p.listPrice != null ? String(p.listPrice) : ''
  const cost = p.purchasePrice != null ? String(p.purchasePrice) : ''
  return {
    product: p, qty: '1', list, disc: discFrom(list, cost), unitCost: cost, gst: String(p.gstRate),
    sell: String(p.sellingPrice ?? ''), dirty: false,
  }
}

// Same rule as the server: line = qty × cost + GST on that, each line rounded to paise
function lineTotal(l: PLine): number {
  const base = cents((Number(l.unitCost) || 0) * (Number(l.qty) || 0))
  const gst = Math.round((base * (Number(l.gst) || 0)) / 100)
  return (base + gst) / 100
}

type EditField = 'qty' | 'list' | 'disc' | 'unitCost' | 'gst' | 'sell'

export default function PurchaseEntryPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [d, setD, clearDraft] = usePersistentState<Draft>('spares_purchase_draft', makeEmpty())
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [invoiceNoError, setInvoiceNoError] = useState('')
  const [saved, setSaved] = useState<PurchaseFull | null>(null)
  const [importing, setImporting] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const total = Math.round(d.lines.reduce((s, l) => s + cents(lineTotal(l)), 0)) / 100
  const paid = Number(d.paid) || 0
  const due = Math.round((total - paid) * 100) / 100

  const addProduct = (p: Product) => {
    setError('')
    setD((prev) => {
      const i = prev.lines.findIndex((l) => l.product.id === p.id)
      if (i >= 0) {
        const lines = [...prev.lines]
        lines[i] = { ...lines[i], qty: String((Number(lines[i].qty) || 0) + 1) }
        return { ...prev, lines }
      }
      return { ...prev, lines: [...prev.lines, freshLine(p)] }
    })
    setTimeout(() => { const el = qtyRefs.current[p.id]; el?.focus(); el?.select() }, 60)
  }

  // One box changed. List and Disc % fill the cost; List and GST fill the selling price.
  const edit = (id: number, field: EditField, value: string) =>
    setD((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.product.id !== id) return l
        const n: PLine = { ...l, list: listOf(l), disc: discOf(l), sell: sellOf(l), [field]: value }
        if (field !== 'qty') n.dirty = true
        if (field === 'list' || field === 'disc') {
          if (n.list !== '') n.unitCost = costFrom(n.list, n.disc)
        }
        if ((field === 'list' || field === 'gst') && n.list !== '') n.sell = sellFrom(n.list, n.gst)
        if (field === 'unitCost') n.disc = discFrom(n.list, n.unitCost)
        return n
      }),
    }))
  const removeLine = (id: number) => {
    setD((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.product.id !== id) }))
    searchRef.current?.focus()
  }

  // When a part is edited in Products (or the tab is used again), its fresh values come in here.
  // Lines you have not typed on take the new prices. Lines you typed on keep your numbers.
  useLiveProducts(d.lines.map((l) => l.product.id), (fresh) =>
    setD((prev) => {
      let changed = false
      const lines = prev.lines.map((l) => {
        const p = fresh.find((x) => x.id === l.product.id)
        if (!p || JSON.stringify(p) === JSON.stringify(l.product)) return l
        changed = true
        return l.dirty === false ? { ...freshLine(p), qty: l.qty } : { ...l, product: p }
      })
      return changed ? { ...prev, lines } : prev
    }))

  // lines from the paste-from-Excel box; a part already on the screen is added to
  const addImported = (rows: ImportedRow[]) => {
    setD((prev) => {
      const out = [...prev.lines]
      for (const r of rows) {
        const list = String(r.list)
        const disc = String(r.disc)
        const line: PLine = {
          product: r.product, qty: String(r.qty), list, disc, unitCost: costFrom(list, disc),
          gst: String(r.gst), sell: String(r.sell), dirty: true,
        }
        const i = out.findIndex((l) => l.product.id === r.product.id)
        if (i >= 0) out[i] = { ...line, qty: String((Number(out[i].qty) || 0) + r.qty) }
        else out.push(line)
      }
      return { ...prev, lines: out }
    })
    setImporting(false)
  }

  // ---- problems and warnings, shown in the right panel so the table never moves ----
  const lineProblems = d.lines.flatMap((l) => {
    const out: string[] = []
    const q = Number(l.qty)
    if (!Number.isInteger(q) || q < 1) out.push(`${l.product.partNumber}: quantity must be a whole number, 1 or more`)
    if (l.unitCost === '' || Number(l.unitCost) < 0) out.push(`${l.product.partNumber}: enter the cost price`)
    if (listOf(l) !== '' && Number(listOf(l)) <= 0) out.push(`${l.product.partNumber}: list price must be more than 0`)
    if (discOf(l) !== '' && (Number(discOf(l)) < 0 || Number(discOf(l)) > 100))
      out.push(`${l.product.partNumber}: discount must be 0 to 100`)
    if (l.gst === '' || Number(l.gst) < 0 || Number(l.gst) > 40) out.push(`${l.product.partNumber}: GST must be 0 to 40`)
    if (sellOf(l) !== '' && Number(sellOf(l)) <= 0) out.push(`${l.product.partNumber}: selling price must be more than 0`)
    return out
  })
  const belowCostLines = d.lines.filter(belowCost)
  const supplierError = touched && !d.supplier ? 'Choose a supplier' : ''
  const paidError =
    d.paid !== '' && (paid < 0 || paid > total) ? `Cannot be more than the total (${inr(total)})` : ''
  const linesError = touched && d.lines.length === 0 ? 'Add at least one item.' : ''

  const save = useMutation({
    mutationFn: async () =>
      (await api.post<PurchaseFull>('/purchases', {
        supplierId: d.supplier!.id,
        supplierInvoiceNo: d.invoiceNo.trim() || null,
        purchaseDate: d.date,
        items: d.lines.map((l) => {
          const sell = Number(sellOf(l))
          const changed = sellOf(l) !== '' && sell > 0 && cents(sell) !== cents(l.product.sellingPrice ?? 0)
          const list = Number(listOf(l))
          const listChanged = listOf(l) !== '' && list > 0 && cents(list) !== cents(l.product.listPrice ?? 0)
          return {
            productId: l.product.id, quantity: Number(l.qty), unitCost: Number(l.unitCost), gstRate: Number(l.gst),
            ...(changed ? { newSellingPrice: sell } : {}),
            ...(listChanged ? { newListPrice: list } : {}),
          }
        }),
        paidAmount: paid,
        paymentMethod: d.method,
        notes: d.notes.trim() || null,
        updatePurchasePrice: d.updatePrice,
      })).data,
    onSuccess: (p) => {
      setSaved(p)
      clearDraft()
      for (const k of ['purchases', 'purchase-dues', 'products', 'product-live', 'product-pick', 'dashboard'])
        qc.invalidateQueries({ queryKey: [k] })
    },
    onError: (e) => {
      const msg = errorMessage(e)
      if (/supplier invoice number/i.test(msg)) setInvoiceNoError(msg)
      else setError(msg)
    },
  })

  const submit = () => {
    setTouched(true)
    setError('')
    setInvoiceNoError('')
    if (!d.supplier || d.lines.length === 0 || lineProblems.length > 0 || paidError) return
    save.mutate()
  }

  const rightAlign = { htmlInput: { style: { textAlign: 'right' as const } } }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>New purchase (stock in)</Typography>
        <Button variant="outlined" sx={{ mr: 1 }} onClick={() => setImporting(true)}>Import from supplier bill</Button>
        <Button onClick={() => navigate('/purchases')}>Back to purchases</Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <Paper sx={{ p: 2 }}>
            <ProductSearch onPick={addProduct} inputRef={searchRef} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Type the List price and your Disc %. The cost and the selling price fill in by themselves (cost = list less
              discount, selling = list plus GST). You can still change any box.
            </Typography>
          </Paper>

          {/* only this box scrolls, so the search box above stays in view */}
          <Paper sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 330px)', minHeight: 220 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1320, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell>Part</TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>Qty</TableCell>
                  <TableCell align="right" sx={{ width: 150 }}>List price</TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>Disc %</TableCell>
                  <TableCell align="right" sx={{ width: 150 }}>Cost (excl. GST)</TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>GST %</TableCell>
                  <TableCell align="right" sx={{ width: 160 }}>Selling (incl. GST)</TableCell>
                  <TableCell align="right" sx={{ width: 140 }}>Line total</TableCell>
                  <TableCell sx={{ width: 56 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {d.lines.map((l) => {
                  const badQty = !Number.isInteger(Number(l.qty)) || Number(l.qty) < 1
                  const num = (field: EditField, value: string, extra: object = {}) => (
                    <TextField size="small" type="number" fullWidth value={value}
                      onChange={(e) => edit(l.product.id, field, e.target.value)}
                      slotProps={{ htmlInput: { min: 0, style: { textAlign: 'right' } } }} {...extra} />
                  )
                  return (
                    <TableRow key={l.product.id}>
                      <TableCell sx={{ overflow: 'hidden' }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>{l.product.partNumber}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}
                          title={l.product.name}>
                          {l.product.name} · now in stock {l.product.stockQty}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <TextField size="small" type="number" fullWidth value={l.qty} error={badQty}
                          inputRef={(el) => { qtyRefs.current[l.product.id] = el }}
                          onChange={(e) => edit(l.product.id, 'qty', e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchRef.current?.focus() } }}
                          slotProps={{ htmlInput: { min: 1, style: { textAlign: 'right' } } }} />
                      </TableCell>
                      <TableCell align="right">{num('list', listOf(l))}</TableCell>
                      <TableCell align="right">{num('disc', discOf(l))}</TableCell>
                      <TableCell align="right">{num('unitCost', l.unitCost, { error: l.unitCost === '' })}</TableCell>
                      <TableCell align="right">{num('gst', l.gst)}</TableCell>
                      <TableCell align="right">{num('sell', sellOf(l), { error: belowCost(l) })}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{inr(lineTotal(l))}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => removeLine(l.product.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {d.lines.length === 0 && (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No items yet. Search for a part above and press Enter, or use Import from supplier bill.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Box>

        <Box sx={{ display: 'grid', gap: 2 }}>
          <Paper sx={{ p: 2, display: 'grid', gap: 2 }}>
            <SupplierPicker value={d.supplier} error={supplierError}
              onChange={(s) => setD((p) => ({ ...p, supplier: s }))} />
            <TextField label="Supplier's invoice number" value={d.invoiceNo}
              onChange={(e) => { setD((p) => ({ ...p, invoiceNo: e.target.value })); setInvoiceNoError('') }}
              error={!!invoiceNoError} helperText={invoiceNoError || 'Stops the same bill being entered twice'} />
            <TextField label="Purchase date" type="date" value={d.date}
              onChange={(e) => setD((p) => ({ ...p, date: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIST() } }} />
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="h6">Total</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{inr(total)}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">Includes GST. The saved purchase shows the exact figure.</Typography>
            <TextField label="Paid now" type="number" fullWidth sx={{ mt: 2 }} value={d.paid}
              onChange={(e) => setD((p) => ({ ...p, paid: e.target.value }))}
              error={!!paidError} helperText={paidError || 'Leave empty if you will pay the supplier later'}
              slotProps={rightAlign} />
            {paid > 0 && (
              <TextField select label="Method" fullWidth sx={{ mt: 2 }} value={d.method}
                onChange={(e) => setD((p) => ({ ...p, method: e.target.value as PayMethod }))}>
                {(['CASH', 'UPI', 'CARD', 'BANK'] as PayMethod[]).map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            )}
            {due > 0 && <Typography sx={{ mt: 1 }} color="warning.dark">You will owe the supplier {inr(due)}</Typography>}
            <TextField label="Notes" fullWidth sx={{ mt: 2 }} value={d.notes}
              onChange={(e) => setD((p) => ({ ...p, notes: e.target.value }))} />
            <FormControlLabel sx={{ mt: 1 }}
              control={<Checkbox checked={d.updatePrice} onChange={(e) => setD((p) => ({ ...p, updatePrice: e.target.checked }))} />}
              label="Update each part's cost price to this cost" />
          </Paper>

          {belowCostLines.length > 0 && (
            <Alert severity="warning">
              Selling price is below your cost for:{' '}
              {belowCostLines.map((l) =>
                `${l.product.partNumber} (cost ${inr(costWithGst(l))} with GST, selling ${inr(Number(sellOf(l)))})`).join('; ')}.
              Change the Selling column if this is not what you want.
            </Alert>
          )}
          {(linesError || (touched && lineProblems.length > 0)) && (
            <Alert severity="error">{linesError || lineProblems.join('. ')}</Alert>
          )}
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

          <Button variant="contained" size="large" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save purchase'}
          </Button>
          <Button color="inherit" disabled={save.isPending || (d.lines.length === 0 && !d.supplier)}
            onClick={() => { clearDraft(); setTouched(false); setError(''); setInvoiceNoError('') }}>
            Clear
          </Button>
        </Box>
      </Box>

      {importing && <ImportBillDialog onClose={() => setImporting(false)} onImport={addImported} />}

      <Dialog open={!!saved} onClose={() => setSaved(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Purchase saved</DialogTitle>
        <DialogContent>
          <Typography>Stock has been added for {saved?.items.length} item(s).</Typography>
          <Typography sx={{ mt: 1 }}>Total {inr(saved?.totalAmount)} · Paid {inr(saved?.paidAmount)}</Typography>
          {(saved?.dueAmount ?? 0) > 0 && <Typography color="warning.dark">Due to supplier {inr(saved?.dueAmount)}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigate('/purchases')}>View purchases</Button>
          <Button variant="contained" autoFocus onClick={() => { setSaved(null); setTouched(false); setTimeout(() => searchRef.current?.focus(), 50) }}>
            New purchase
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
