import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Table,
  TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type Customer, type Product, type QuotationFull } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useDraft, type Line } from '../../billing/DraftContext'
import { fmtDate } from '../../utils/format'
import { todayIST } from '../../utils/dates'
import PrintableQuotation from './PrintableQuotation'

export default function QuotationDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { draft, update } = useDraft()
  const [printing, setPrinting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: q, isLoading, error: loadError } = useQuery({
    queryKey: ['quotation', id],
    queryFn: async () => (await api.get<QuotationFull>(`/quotations/${id}`)).data,
  })

  useEffect(() => {
    if (!printing) return
    const t = setTimeout(() => { window.print(); setPrinting(false) }, 150)
    return () => clearTimeout(t)
  }, [printing])

  const cancel = useMutation({
    mutationFn: () => api.post(`/quotations/${id}/cancel`, { reason: reason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation', id] })
      qc.invalidateQueries({ queryKey: ['quotations'] })
      setCancelling(false)
      setReason('')
    },
    onError: (e) => setError(errorMessage(e)),
  })

  // Fill the Billing screen from this quotation. The user reviews it and saves it there,
  // so the usual stock and credit checks still apply.
  const createBill = async () => {
    if (!q) return
    if (draft.lines.length > 0 && !window.confirm('This replaces the bill you are currently entering. Continue?')) return
    setBusy(true)
    setError('')
    try {
      const withProduct = q.items.filter((i) => i.productId != null)
      const skipped = q.items.length - withProduct.length
      const products = await Promise.all(
        withProduct.map((i) => api.get<Product>(`/products/${i.productId}`).then((r) => r.data)),
      )
      // Same part on two quotation lines becomes one billing line
      const merged = new Map<number, Line>()
      let cheaperThanShelf = 0
      withProduct.forEach((i, idx) => {
        const p = products[idx]
        const shelfC = Math.round(p.sellingPrice * 100) * i.quantity
        const quotedC = Math.round(i.lineTotal * 100)
        if (quotedC > shelfC) cheaperThanShelf++
        const discountC = Math.max(0, shelfC - quotedC)
        const prev = merged.get(p.id)
        if (prev) {
          merged.set(p.id, {
            product: p,
            qty: String(Number(prev.qty) + i.quantity),
            discount: String(((Math.round(Number(prev.discount || 0) * 100) + discountC) / 100).toFixed(2)),
          })
        } else {
          merged.set(p.id, { product: p, qty: String(i.quantity), discount: discountC > 0 ? (discountC / 100).toFixed(2) : '' })
        }
      })

      let customer: Customer | null = null
      if (q.customerId) {
        customer = (await api.get<Customer>(`/customers/${q.customerId}`)).data
      }

      update((d) => ({ ...d, customer, lines: [...merged.values()], payMode: 'FULL', partAmount: '' }))

      const notes: string[] = []
      if (skipped > 0) notes.push(`${skipped} custom line(s) with no stock item were left out.`)
      if (cheaperThanShelf > 0) notes.push(`${cheaperThanShelf} line(s) were quoted above the shelf price, so the bill uses the shelf price for them.`)
      if (!customer) notes.push('This quotation has no saved customer, so pick the customer on the Billing screen if the bill is on credit.')
      if (notes.length) window.alert(notes.join('\n\n'))
      navigate('/billing')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const open = q?.status === 'OPEN'
  const expired = open && !!q && q.validUntil < todayIST()

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {q?.quotationNo ?? 'Quotation'}
          {q && q.revision > 1 && <Chip size="small" label={`Rev ${q.revision}`} />}
          {q && <Chip size="small" color={open ? 'success' : 'error'} label={q.status} />}
          {expired && <Chip size="small" color="warning" label="Expired" />}
        </DialogTitle>
        <DialogContent>
          {isLoading && <CircularProgress />}
          {loadError && <Alert severity="error">{errorMessage(loadError)}</Alert>}
          {q && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Box>
                  <Typography><b>To:</b> {q.buyerName}</Typography>
                  {q.buyerGstin && <Typography><b>GSTIN:</b> {q.buyerGstin}</Typography>}
                  <Typography><b>Place of supply:</b> {q.placeOfSupplyName} ({q.placeOfSupply})</Typography>
                  <Typography><b>Date:</b> {fmtDate(q.quotationDate)} · <b>Valid until:</b> {fmtDate(q.validUntil)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{inr(q.grandTotal)}</Typography>
                  <Typography variant="body2">Before tax {inr(q.taxableAmount)}</Typography>
                  <Typography variant="body2">
                    {q.sameState ? `CGST ${inr(q.cgstTotal)} + SGST ${inr(q.sgstTotal)}` : `IGST ${inr(q.igstTotal)}`}
                  </Typography>
                  <Typography variant="body2">Discount given {inr(q.discountTotal)}</Typography>
                </Box>
              </Box>
              {q.status === 'CANCELLED' && <Alert severity="error" sx={{ mb: 2 }}>Cancelled: {q.cancelReason}</Alert>}

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell><TableCell>Part</TableCell><TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Rate</TableCell><TableCell align="right">Disc %</TableCell>
                    <TableCell align="right">Taxable</TableCell><TableCell align="right">GST</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {q.items.map((l) => (
                    <TableRow key={l.lineNo}>
                      <TableCell>{l.lineNo}</TableCell>
                      <TableCell>{l.partNumber ? `${l.partNumber} · ` : ''}{l.description}</TableCell>
                      <TableCell align="right">{l.quantity} {l.unit}</TableCell>
                      <TableCell align="right">{inr(l.unitPrice)}</TableCell>
                      <TableCell align="right">{l.discountPercent}</TableCell>
                      <TableCell align="right">{inr(l.taxableAmount)}</TableCell>
                      <TableCell align="right">{l.gstRate}%</TableCell>
                      <TableCell align="right">{inr(l.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {cancelling && (
                <Box sx={{ mt: 3, p: 2, border: 1, borderColor: 'error.main', borderRadius: 1 }}>
                  {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
                  <TextField label="Reason for cancelling" size="small" fullWidth autoFocus value={reason}
                    onChange={(e) => setReason(e.target.value)} />
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button color="error" variant="contained" disabled={!reason.trim() || cancel.isPending}
                      onClick={() => { setError(''); cancel.mutate() }}>Confirm cancel</Button>
                    <Button onClick={() => { setCancelling(false); setError('') }}>Keep quotation</Button>
                  </Box>
                </Box>
              )}
              {!cancelling && error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap' }}>
          {isOwner && open && !cancelling && (
            <Button color="error" sx={{ mr: 'auto' }} onClick={() => setCancelling(true)}>Cancel quotation</Button>
          )}
          {open && <Button onClick={() => navigate(`/quotations/${id}/edit`)}>Edit</Button>}
          <Button disabled={!q} onClick={() => navigate(`/quotations/new?from=${id}`)}>Duplicate</Button>
          {open && <Button color="warning" disabled={busy} onClick={createBill}>
            {busy ? 'Preparing…' : 'Create bill'}
          </Button>}
          <Button variant="contained" disabled={!q} onClick={() => setPrinting(true)}>Print A4</Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {q && printing && createPortal(
        <div id="print-root"><PrintableQuotation q={q} /></div>,
        document.body,
      )}
    </>
  )
}