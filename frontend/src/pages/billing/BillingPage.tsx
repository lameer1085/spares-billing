import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem,
  Paper, Radio, RadioGroup, FormControlLabel, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { api, errorMessage } from '../../api/client'
import { inr, type Customer, type InvoiceResult, type PayMethod, type Product } from '../../api/types'
import type { Line, PayMode } from '../../billing/DraftContext'
import CustomerPicker from './CustomerPicker'
import { useDraft } from '../../billing/DraftContext'
import ProductSearch from './ProductSearch'

const r2 = (n: number) => Math.round(n * 100) / 100

// If a percent is set on the line, the rupee discount follows it (also when the quantity changes)
const withPct = (l: Line, patch: Partial<Line>): Line => {
  const next = { ...l, ...patch }
  if (next.discountPct) {
    const gross = r2(next.product.sellingPrice * (Number(next.qty) || 0))
    next.discount = String(r2((gross * Number(next.discountPct)) / 100))
  }
  return next
}

export default function BillingPage() {
  const qc = useQueryClient()
  const { draft, update, clear } = useDraft()
  const { customer, lines, payMode, partAmount, method } = draft

  // The draft lives in DraftContext, so it survives moving to another page and back
  const setCustomer = (c: Customer | null) => update((d) => ({ ...d, customer: c, payMode: c ? d.payMode : 'FULL' }))
  const setLines = (fn: (prev: Line[]) => Line[]) => update((d) => ({ ...d, lines: fn(d.lines) }))
  const setPayMode = (m: PayMode) => update((d) => ({ ...d, payMode: m }))
  const setPartAmount = (v: string) => update((d) => ({ ...d, partAmount: v }))
  const setMethod = (m: PayMethod) => update((d) => ({ ...d, method: m }))

  const [error, setError] = useState('')
  const [partTouched, setPartTouched] = useState(false)
  const [saved, setSaved] = useState<InvoiceResult | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const [focusId, setFocusId] = useState<number | null>(null)
  const [allPct, setAllPct] = useState('')

  const isWalkIn = customer === null
  const mode: PayMode = isWalkIn ? 'FULL' : payMode // walk-in customers must pay in full

  // ---- totals (same rule as the server: sum of lines, rounded to the nearest rupee) ----
  const calc = lines.map((l) => {
    const qty = Number(l.qty) || 0
    const gross = r2(l.product.sellingPrice * qty)
    const disc = Number(l.discount) || 0
    return { qty, gross, disc, net: r2(gross - disc) }
  })
  const subtotal = r2(calc.reduce((s, c) => s + c.gross, 0))
  const discountTotal = r2(calc.reduce((s, c) => s + c.disc, 0))
  const net = r2(subtotal - discountTotal)
  const total = Math.round(net)
  const roundOff = r2(total - net)
  const paying = mode === 'FULL' ? total : mode === 'CREDIT' ? 0 : Number(partAmount) || 0
  const due = r2(total - paying)

  // ---- live problems ----
  const stockProblems = lines
    .map((l, i) => ({ l, over: calc[i].qty > l.product.stockQty }))
    .filter((x) => x.over)
    .map((x) => `${x.l.product.partNumber}: only ${x.l.product.stockQty} in stock`)

  const partInvalid = mode === 'PART' && (paying <= 0 || paying >= total)
  const partError =
    partInvalid && (partTouched || partAmount !== '')
      ? total === 0
        ? 'Add items first'
        : `Enter more than ₹0 and less than the bill total (${inr(total)})`
      : ''

  // ---- focus handling ----
  useEffect(() => {
    if (focusId !== null) {
      const el = qtyRefs.current[focusId]
      if (el) { el.focus(); el.select() }
      setFocusId(null)
    }
  }, [focusId, lines])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); document.getElementById('save-bill')?.click() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- line actions ----
  const addProduct = (p: Product) => {
    setError('')
    if (p.stockQty <= 0) { setError(`${p.partNumber} is out of stock.`); return }
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id)
      if (i >= 0) {
        const copy = [...prev]
          copy[i] = withPct(copy[i], { qty: String((Number(copy[i].qty) || 0) + 1) })
        return copy
      }
      return [...prev, { product: p, qty: '1', discount: '' }]
    })
    setFocusId(p.id)
  }
    const updateLine = (id: number, patch: Partial<Line>) =>
      setLines((prev) => prev.map((l) => (l.product.id === id ? withPct(l, patch) : l)))
    const applyAll = () => {
      if (allPct === '' || Number(allPct) < 0 || Number(allPct) > 100) return
      setLines((prev) => prev.map((l) => withPct(l, { discountPct: allPct })))
    }
  const removeLine = (id: number) => {
    setLines((prev) => prev.filter((l) => l.product.id !== id))
    searchRef.current?.focus()
  }

  // ---- validation and save ----
  const validate = (): string => {
    if (lines.length === 0) return 'Add at least one item.'
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const q = Number(l.qty)
      if (!Number.isInteger(q) || q < 1) return `${l.product.partNumber}: quantity must be a whole number, 1 or more.`
      if (q > l.product.stockQty) return `${l.product.partNumber}: only ${l.product.stockQty} in stock.`
      if (calc[i].disc < 0 || calc[i].disc > calc[i].gross)
        return `${l.product.partNumber}: discount must be between 0 and the line amount.`
    }
    return ''
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        customerId: customer?.id ?? null,
        items: lines.map((l) => ({
          productId: l.product.id,
          quantity: Number(l.qty),
          discountAmount: Number(l.discount) || 0,
        })),
        paidAmount: mode === 'FULL' ? null : paying,
        paymentMethod: method,
      }
      return (await api.post<InvoiceResult>('/invoices', body)).data
    },
    onSuccess: (inv) => {
      setSaved(inv)
      clear() // the bill is saved, so the draft must go, or it could be saved twice
      setPartTouched(false)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product-pick'] })
      qc.invalidateQueries({ queryKey: ['dues'] })
      qc.invalidateQueries({ queryKey: ['balance'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const submit = () => {
    setPartTouched(true)
    const msg = validate()
    setError(msg)
    if (msg || partInvalid) return
    save.mutate()
  }

  const clearBill = () => {
    clear()
    setError('')
    setPartTouched(false)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  const closeSaved = () => {
    setSaved(null)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' }, gap: 2, alignItems: 'start' }}>
      {/* LEFT: items */}
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ flexGrow: 1, minWidth: 280 }}>
            <ProductSearch onPick={addProduct} inputRef={searchRef} />
          </Box>
          <TextField size="small" type="number" label="Discount % for all" value={allPct} sx={{ width: 170 }}
            onChange={(e) => setAllPct(e.target.value)}
            slotProps={{ htmlInput: { min: 0, max: 100, style: { textAlign: 'right' } } }} />
          <Button variant="outlined" onClick={applyAll} disabled={allPct === '' || lines.length === 0}>
            Apply to all
          </Button>
        </Paper>

        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Part</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right" sx={{ width: 90 }}>Qty</TableCell>
                <TableCell align="right" sx={{ width: 100 }}>Disc %</TableCell>
                <TableCell align="right" sx={{ width: 110 }}>Discount ₹</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l, i) => {
                const over = calc[i].qty > l.product.stockQty
                return (
                  <TableRow key={l.product.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{l.product.partNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {l.product.name} · GST {l.product.gstRate}% · Stock {l.product.stockQty}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{inr(l.product.sellingPrice)}</TableCell>
                    <TableCell align="right">
                      <TextField size="small" type="number" value={l.qty} error={over}
                        inputRef={(el) => { qtyRefs.current[l.product.id] = el }}
                        onChange={(e) => updateLine(l.product.id, { qty: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchRef.current?.focus() } }}
                        slotProps={{ htmlInput: { min: 1, style: { textAlign: 'right' } } }} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" type="number" value={l.discountPct ?? ''}
                        onChange={(e) => updateLine(l.product.id,
                          e.target.value === '' ? { discountPct: '', discount: '' } : { discountPct: e.target.value })}
                        slotProps={{ htmlInput: { min: 0, max: 100, style: { textAlign: 'right' } } }} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" type="number" value={l.discount}
                        onChange={(e) => updateLine(l.product.id, { discount: e.target.value, discountPct: '' })}
                        slotProps={{ htmlInput: { min: 0, style: { textAlign: 'right' } } }} />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{inr(calc[i].net)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeLine(l.product.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
              {lines.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  No items yet. Search for a part above and press Enter.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>

      {/* RIGHT: customer, totals, payment, messages, save */}
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <CustomerPicker value={customer} onChange={setCustomer} />
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Row label="Subtotal" value={inr(subtotal)} />
          <Row label="Discount" value={`− ${inr(discountTotal)}`} />
          <Row label="Round off" value={inr(roundOff)} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, alignItems: 'baseline' }}>
            <Typography variant="h6">Total</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{inr(total)}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Prices include GST. The CGST/SGST/IGST split is shown on the saved bill.
          </Typography>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Payment</Typography>
          <RadioGroup value={mode} onChange={(e) => setPayMode(e.target.value as PayMode)}>
            <FormControlLabel value="FULL" control={<Radio size="small" />} label="Paid in full" />
            <FormControlLabel value="CREDIT" disabled={isWalkIn} control={<Radio size="small" />} label="On credit (nothing paid now)" />
            <FormControlLabel value="PART" disabled={isWalkIn} control={<Radio size="small" />} label="Part payment" />
          </RadioGroup>
          {isWalkIn && <Typography variant="caption" color="text.secondary">Choose a customer to allow credit.</Typography>}
          {mode === 'PART' && (
            <TextField size="small" type="number" label="Amount paid now" fullWidth sx={{ mt: 1 }}
              value={partAmount} onChange={(e) => setPartAmount(e.target.value)}
              error={!!partError} helperText={partError} />
          )}
          {mode !== 'CREDIT' && (
            <TextField select size="small" label="Method" fullWidth sx={{ mt: 2 }}
              value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
              {(['CASH', 'UPI', 'CARD', 'BANK'] as PayMethod[]).map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
          )}
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Chip label={`Paying ${inr(paying)}`} color="success" variant="outlined" />
            {due > 0 && <Chip label={`Due ${inr(due)}`} color="warning" />}
          </Box>
        </Paper>

        {/* Messages sit just above the Save button, so nothing in the item table moves */}
        {stockProblems.length > 0 && (
          <Alert severity="error">{stockProblems.join('. ')}</Alert>
        )}
        {error && !stockProblems.length && (
          <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
        )}

        <Button id="save-bill" variant="contained" size="large" onClick={submit}
          disabled={save.isPending || lines.length === 0}>
          {save.isPending ? 'Saving…' : 'Save bill (Ctrl+Enter)'}
        </Button>
        <Button color="inherit" onClick={clearBill} disabled={save.isPending || (lines.length === 0 && !customer)}>
          Clear bill
        </Button>
      </Box>

      {/* After save */}
      <Dialog open={!!saved} onClose={closeSaved} maxWidth="xs" fullWidth>
        <DialogTitle>Bill saved</DialogTitle>
        <DialogContent>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{saved?.invoiceNo}</Typography>
          <Box sx={{ mt: 2 }}>
            <Row label="Taxable value" value={inr(saved?.taxableAmount)} />
            {(saved?.cgstTotal ?? 0) > 0 && <Row label="CGST" value={inr(saved?.cgstTotal)} />}
            {(saved?.sgstTotal ?? 0) > 0 && <Row label="SGST" value={inr(saved?.sgstTotal)} />}
            {(saved?.igstTotal ?? 0) > 0 && <Row label="IGST" value={inr(saved?.igstTotal)} />}
            <Row label="Round off" value={inr(saved?.roundOff)} />
            <Row label="Total" value={inr(saved?.grandTotal)} bold />
            <Row label="Paid" value={inr(saved?.paidAmount)} />
            <Row label="Due" value={inr(saved?.dueAmount)} bold />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" autoFocus onClick={closeSaved}>New bill</Button>
        </DialogActions>
      </Dialog>
    </Box>
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