import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type CreditNoteSummary, type InvoiceFull, type PageResponse } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { fmtDate } from '../../utils/format'
import PrintableInvoice from './PrintableInvoice'
import ReturnDialog from './ReturnDialog'
import CreditNoteDialog from './CreditNoteDialog'
import EwayDialog from './EwayDialog'
import { ewayNeeded } from './ewayJson'
import type { EwayDetails } from '../../api/types'


export default function InvoiceDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [printMode, setPrintMode] = useState<'a4' | 'receipt' | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [returning, setReturning] = useState(false)
  const [openCn, setOpenCn] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [ewayOpen, setEwayOpen] = useState(false)

  const { data: inv, isLoading, error: loadError } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => (await api.get<InvoiceFull>(`/invoices/${id}`)).data,
  })
  const eway = useQuery({
    queryKey: ['eway', id],
    enabled: !!inv,
    queryFn: async () => (await api.get<EwayDetails>(`/invoices/${id}/eway`)).data,
  })

  const creditNotes = useQuery({
    queryKey: ['credit-notes', 'invoice', id],
    queryFn: async () =>
      (await api.get<PageResponse<CreditNoteSummary>>('/credit-notes', { params: { invoiceId: id, size: 100 } })).data.content,
  })
  const notes = creditNotes.data ?? []
  const creditedBefore = notes.reduce((s, n) => s + n.grandTotal, 0)

  useEffect(() => {
    if (!printMode) return
    const t = setTimeout(() => { window.print(); setPrintMode(null) }, 150)
    return () => clearTimeout(t)
  }, [printMode])

  const cancel = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/cancel`, { reason: reason.trim() }),
    onSuccess: () => {
      for (const k of ['invoice', 'invoices', 'products', 'dues', 'balance'])
        qc.invalidateQueries({ queryKey: [k] })
      setCancelling(false)
      setReason('')
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const igst = (inv?.igstTotal ?? 0) > 0
  const active = inv?.status === 'ACTIVE'
  const canReturn = isOwner && active && !!inv?.items.some((l) => l.quantity - l.returnedQuantity > 0)
  const canCancel = isOwner && active && notes.length === 0 && !creditNotes.isLoading

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {inv?.invoiceNo ?? 'Invoice'}
          {inv && <Chip size="small" label={inv.status} color={active ? 'success' : 'error'} />}
        </DialogTitle>
        <DialogContent>
          {isLoading && <CircularProgress />}
          {loadError && <Alert severity="error">{errorMessage(loadError)}</Alert>}
          {inv && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Box>
                  <Typography><b>Date:</b> {fmtDate(inv.invoiceDate)}</Typography>
                  <Typography><b>Customer:</b> {inv.customer?.name ?? 'Walk-in'}</Typography>
                  {inv.customer?.gstin && <Typography><b>GSTIN:</b> {inv.customer.gstin}</Typography>}
                  <Typography><b>Place of supply:</b> {inv.placeOfSupplyName}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{inr(inv.grandTotal)}</Typography>
                  <Typography>Paid {inr(inv.paidAmount)}</Typography>
                  {inv.dueAmount > 0 && <Typography color="warning.dark">Due {inr(inv.dueAmount)}</Typography>}
                </Box>
              </Box>

              {inv.status === 'CANCELLED' && (
                <Alert severity="error" sx={{ mb: 2 }}>Cancelled: {inv.cancelReason}</Alert>
              )}

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell><TableCell>HSN</TableCell>
                    <TableCell align="right">Qty</TableCell><TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Disc</TableCell><TableCell align="right">Taxable</TableCell>
                    <TableCell align="right">GST</TableCell>
                    <TableCell align="right">{igst ? 'IGST' : 'CGST + SGST'}</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inv.items.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {l.description}
                        {l.returnedQuantity > 0 && (
                          <Chip size="small" color="warning" variant="outlined" sx={{ ml: 1 }}
                            label={`${l.returnedQuantity} returned`} />
                        )}
                      </TableCell>
                      <TableCell>{l.hsnCode}</TableCell>
                      <TableCell align="right">{l.quantity}</TableCell>
                      <TableCell align="right">{inr(l.unitPrice)}</TableCell>
                      <TableCell align="right">{l.discountAmount ? inr(l.discountAmount) : ''}</TableCell>
                      <TableCell align="right">{inr(l.taxableAmount)}</TableCell>
                      <TableCell align="right">{l.gstRate}%</TableCell>
                      <TableCell align="right">
                        {igst ? inr(l.igstAmount) : `${inr(l.cgstAmount)} + ${inr(l.sgstAmount)}`}
                      </TableCell>
                      <TableCell align="right">{inr(l.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Box sx={{ mt: 2, textAlign: 'right' }}>
                <Typography>Taxable {inr(inv.taxableAmount)}</Typography>
                {igst
                  ? <Typography>IGST {inr(inv.igstTotal)}</Typography>
                  : <Typography>CGST {inr(inv.cgstTotal)} · SGST {inr(inv.sgstTotal)}</Typography>}
                <Typography>Round off {inr(inv.roundOff)}</Typography>
              </Box>

              {inv.payments.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Payments received</Typography>
                  {inv.payments.map((p) => (
                    <Typography key={p.id} variant="body2">
                      {fmtDate(p.paymentDate)} · {inr(p.amount)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}
                    </Typography>
                  ))}
                </Box>
              )}

              {notes.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Credit notes (returns)</Typography>
                  {notes.map((n) => (
                    <Box key={n.id} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Button size="small" onClick={() => setOpenCn(n.id)}>{n.creditNoteNo}</Button>
                      <Typography variant="body2">
                        {fmtDate(n.creditNoteDate)} · {inr(n.grandTotal)}
                        {n.refundAmount > 0 ? ` · refunded ${inr(n.refundAmount)}` : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {isOwner && active && notes.length > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  This bill cannot be cancelled because returns were recorded on it. Record further returns instead.
                </Alert>
              )}

              {cancelling && (
                <Box sx={{ mt: 3, p: 2, border: 1, borderColor: 'error.main', borderRadius: 1 }}>
                  <Typography sx={{ mb: 1 }}>
                    Cancelling puts the stock back and removes this bill from sales and the customer's balance.
                    For a filed GST month, use Return items (credit note) instead.
                  </Typography>
                  {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
                  <TextField label="Reason for cancelling" fullWidth size="small" autoFocus value={reason}
                    onChange={(e) => setReason(e.target.value)} />
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button color="error" variant="contained" disabled={!reason.trim() || cancel.isPending}
                      onClick={() => { setError(''); cancel.mutate() }}>
                      Confirm cancel
                    </Button>
                    <Button onClick={() => { setCancelling(false); setError('') }}>Keep bill</Button>
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {canCancel && !cancelling && (
            <Button color="error" onClick={() => setCancelling(true)} sx={{ mr: 'auto' }}>Cancel invoice</Button>
          )}
          {canReturn && <Button color="warning" onClick={() => setReturning(true)}>Return items</Button>}
          {inv && inv.status === 'ACTIVE' && (
            <Button color={ewayNeeded(inv) ? 'warning' : 'inherit'} variant={ewayNeeded(inv) ? 'outlined' : 'text'}
              onClick={() => setEwayOpen(true)}>
              {eway.data?.ewayBillNo ? 'E-way bill ✓' : ewayNeeded(inv) ? 'E-way bill (needed)' : 'E-way bill'}
            </Button>
          )}
          <Button disabled={!inv} onClick={() => setPrintMode('receipt')}>Print receipt</Button>
          <Button variant="contained" disabled={!inv} onClick={() => setPrintMode('a4')}>Print A4</Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
       {inv && ewayOpen && (
          <EwayDialog
            inv={inv}
            onClose={() => setEwayOpen(false)}
            />
        )}
      {inv && returning && (
        <ReturnDialog invoice={inv} creditedBefore={creditedBefore}
          onClose={() => setReturning(false)}
          onCreated={(cnId) => { setReturning(false); setOpenCn(cnId) }} />
      )}
      {openCn !== null && <CreditNoteDialog id={openCn} onClose={() => setOpenCn(null)} />}

      {inv && printMode && createPortal(
        <div id="print-root"><PrintableInvoice inv={inv} mode={printMode} /></div>,
        document.body,
      )}
    </>
  )
}