import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type PayMethod, type PurchaseFull } from '../../api/types'
import { fmtDate } from '../../utils/format'

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export default function PurchaseDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'pay' | 'cancel' | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayMethod>('CASH')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(todayIST())
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const { data: p, isLoading, error: loadError } = useQuery({
    queryKey: ['purchase', id],
    queryFn: async () => (await api.get<PurchaseFull>(`/purchases/${id}`)).data,
  })

  const refresh = () => {
    for (const k of ['purchase', 'purchases', 'purchase-dues', 'products', 'product-pick'])
      qc.invalidateQueries({ queryKey: [k] })
    setMode(null); setAmount(''); setReference(''); setReason(''); setError('')
  }

  const pay = useMutation({
    mutationFn: () => api.post(`/purchases/${id}/payments`, {
      amount: Number(amount), method, reference: reference.trim() || null, paymentDate: date || null,
    }),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  })
  const cancel = useMutation({
    mutationFn: () => api.post(`/purchases/${id}/cancel`, { reason: reason.trim() }),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  })

  const amt = Number(amount)
  const amountError = amount !== '' && p && (amt <= 0 || amt > p.dueAmount)
    ? `Enter more than 0 and up to ${inr(p.dueAmount)}` : ''
  const active = p?.status === 'ACTIVE'

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        Purchase #{id}
        {p && <Chip size="small" label={p.status} color={active ? 'success' : 'error'} />}
      </DialogTitle>
      <DialogContent>
        {isLoading && <CircularProgress />}
        {loadError && <Alert severity="error">{errorMessage(loadError)}</Alert>}
        {p && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              <Box>
                <Typography><b>Supplier:</b> {p.supplierName}</Typography>
                <Typography><b>Supplier invoice:</b> {p.supplierInvoiceNo ?? '—'}</Typography>
                <Typography><b>Date:</b> {fmtDate(p.purchaseDate)}</Typography>
                {p.notes && <Typography><b>Notes:</b> {p.notes}</Typography>}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{inr(p.totalAmount)}</Typography>
                <Typography>Paid {inr(p.paidAmount)}</Typography>
                {p.dueAmount > 0 && <Typography color="warning.dark">Due {inr(p.dueAmount)}</Typography>}
              </Box>
            </Box>
            {p.status === 'CANCELLED' && <Alert severity="error" sx={{ mb: 2 }}>Cancelled: {p.cancelReason}</Alert>}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Part</TableCell><TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Cost</TableCell><TableCell align="right">GST</TableCell>
                  <TableCell align="right">Line total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {p.items.map((l) => (
                  <TableRow key={l.productId}>
                    <TableCell>{l.partNumber} · {l.name}</TableCell>
                    <TableCell align="right">{l.quantity}</TableCell>
                    <TableCell align="right">{inr(l.unitCost)}</TableCell>
                    <TableCell align="right">{l.gstRate}%</TableCell>
                    <TableCell align="right">{inr(l.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {p.payments.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Payments to supplier</Typography>
                {p.payments.map((x) => (
                  <Typography key={x.id} variant="body2">
                    {fmtDate(x.paymentDate)} · {inr(x.amount)} · {x.method}{x.reference ? ` · ${x.reference}` : ''}
                  </Typography>
                ))}
              </Box>
            )}

            {mode === 'pay' && (
              <Box sx={{ mt: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1, display: 'grid', gap: 2 }}>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField label="Amount paid" type="number" autoFocus value={amount}
                  onChange={(e) => setAmount(e.target.value)} error={!!amountError} helperText={amountError} />
                <TextField select label="Method" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                  {(['CASH', 'UPI', 'CARD', 'BANK'] as PayMethod[]).map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
                <TextField label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
                <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIST() } }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" disabled={!amount || !!amountError || pay.isPending}
                    onClick={() => { setError(''); pay.mutate() }}>Record payment</Button>
                  <Button onClick={() => { setMode(null); setError('') }}>Close</Button>
                </Box>
              </Box>
            )}

            {mode === 'cancel' && (
              <Box sx={{ mt: 3, p: 2, border: 1, borderColor: 'error.main', borderRadius: 1 }}>
                <Typography sx={{ mb: 1 }}>
                  Cancelling removes this stock again. If some of these parts were already sold, it will be refused.
                  If you entered a wrong amount, cancel it and enter the purchase again.
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
                <TextField label="Reason" size="small" fullWidth autoFocus value={reason}
                  onChange={(e) => setReason(e.target.value)} />
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button color="error" variant="contained" disabled={!reason.trim() || cancel.isPending}
                    onClick={() => { setError(''); cancel.mutate() }}>Confirm cancel</Button>
                  <Button onClick={() => { setMode(null); setError('') }}>Keep purchase</Button>
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {active && mode !== 'cancel' && (
          <Button color="error" sx={{ mr: 'auto' }} onClick={() => { setMode('cancel'); setError('') }}>Cancel purchase</Button>
        )}
        {active && (p?.dueAmount ?? 0) > 0 && mode !== 'pay' && (
          <Button variant="contained" onClick={() => { setMode('pay'); setError('') }}>Pay supplier</Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}