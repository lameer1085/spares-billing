import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type InvoiceFull } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { fmtDate } from '../../utils/format'
import PrintableInvoice from './PrintableInvoice'

export default function InvoiceDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [printMode, setPrintMode] = useState<'a4' | 'receipt' | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const { data: inv, isLoading, error: loadError } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => (await api.get<InvoiceFull>(`/invoices/${id}`)).data,
  })

  // Print after the printable copy has been placed on the page
  useEffect(() => {
    if (!printMode) return
    const t = setTimeout(() => { window.print(); setPrintMode(null) }, 150)
    return () => clearTimeout(t)
  }, [printMode])

  const cancel = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/cancel`, { reason: reason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dues'] })
      qc.invalidateQueries({ queryKey: ['balance'] })
      setCancelling(false)
      setReason('')
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const igst = (inv?.igstTotal ?? 0) > 0

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {inv?.invoiceNo ?? 'Invoice'}
          {inv && (
            <Chip size="small" label={inv.status} color={inv.status === 'ACTIVE' ? 'success' : 'error'} />
          )}
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
                      <TableCell>{l.description}</TableCell>
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

              {cancelling && (
                <Box sx={{ mt: 3, p: 2, border: 1, borderColor: 'error.main', borderRadius: 1 }}>
                  <Typography sx={{ mb: 1 }}>
                    Cancelling puts the stock back and removes this bill from sales and the customer's balance.
                    For a filed GST month, use a credit note (return) instead.
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
          {isOwner && inv?.status === 'ACTIVE' && !cancelling && (
            <Button color="error" onClick={() => setCancelling(true)} sx={{ mr: 'auto' }}>Cancel invoice</Button>
          )}
          <Button disabled={!inv} onClick={() => setPrintMode('receipt')}>Print receipt</Button>
          <Button variant="contained" disabled={!inv} onClick={() => setPrintMode('a4')}>Print A4</Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {inv && printMode && createPortal(
        <div id="print-root"><PrintableInvoice inv={inv} mode={printMode} /></div>,
        document.body,
      )}
    </>
  )
}