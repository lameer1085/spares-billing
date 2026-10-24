import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type CollectionSummary, type PageResponse, type PaymentRow } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { fmtDate } from '../../utils/format'
import ReceivePaymentCard from './ReceivePaymentCard'

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export default function PaymentsPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [from, setFrom] = useState(todayIST())
  const [to, setTo] = useState(todayIST())
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [reversing, setReversing] = useState<PaymentRow | null>(null)
  const [reason, setReason] = useState('')
  const [reverseError, setReverseError] = useState('')

  const list = useQuery({
    queryKey: ['payments', from, to, method, status, page, size],
    enabled: isOwner,
    queryFn: async () =>
      (await api.get<PageResponse<PaymentRow>>('/payments', {
        params: { from: from || undefined, to: to || undefined, method: method || undefined, status: status || undefined, page, size },
      })).data,
    placeholderData: keepPreviousData,
  })

  const summary = useQuery({
    queryKey: ['payment-summary', from, to],
    enabled: isOwner,
    queryFn: async () =>
      (await api.get<CollectionSummary>('/payments/summary', { params: { from: from || undefined, to: to || undefined } })).data,
  })

  const reverse = useMutation({
    mutationFn: () => api.post(`/payments/${reversing!.id}/reverse`, { reason: reason.trim() }),
    onSuccess: () => {
      for (const k of ['payments', 'payment-summary', 'balance', 'dues', 'invoices', 'open-invoices', 'invoice'])
        qc.invalidateQueries({ queryKey: [k] })
      closeReverse()
    },
    onError: (e) => setReverseError(errorMessage(e)),
  })

  const closeReverse = () => { setReversing(null); setReason(''); setReverseError('') }
  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0) }
  const rows = list.data?.content ?? []

  return (
    <>
      <Typography variant="h5" sx={{ mb: 2 }}>Payments</Typography>
      <ReceivePaymentCard />

      {isOwner && (
        <>
          <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField size="small" type="date" label="From" value={from}
              onChange={(e) => reset(setFrom)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="date" label="To" value={to}
              onChange={(e) => reset(setTo)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField select size="small" label="Method" sx={{ minWidth: 120 }} value={method}
              onChange={(e) => reset(setMethod)(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value="">All</MenuItem>
              {['CASH', 'UPI', 'CARD', 'BANK'].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Status" sx={{ minWidth: 120 }} value={status}
              onChange={(e) => reset(setStatus)(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="REVERSED">Reversed</MenuItem>
            </TextField>
            <Box sx={{ flexGrow: 1 }} />
            {summary.data && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.entries(summary.data.byMethod).map(([m, v]) => (
                  <Chip key={m} variant="outlined" label={`${m} ${inr(v)}`} />
                ))}
                {Object.entries(summary.data.refundsByMethod ?? {}).map(([m, v]) => (
                  <Chip key={`r-${m}`} variant="outlined" color="warning" label={`Refunds ${m} −${inr(v)}`} />
                ))}
                <Chip color="success" label={`Net collected ${inr(summary.data.total)}`} />
              </Box>
            )}
          </Paper>

          {list.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(list.error)}</Alert>}

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Applied to</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} hover sx={{ opacity: p.status === 'REVERSED' ? 0.5 : 1 }}>
                    <TableCell>{fmtDate(p.paymentDate)}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{p.customerName}</TableCell>
                    <TableCell>{p.invoiceNo ?? 'On account'}</TableCell>
                    <TableCell align="right">{inr(p.amount)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>{p.reference}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={p.status}
                        color={p.status === 'ACTIVE' ? 'success' : 'default'} title={p.reverseReason ?? ''} />
                    </TableCell>
                    <TableCell align="right">
                      {p.status === 'ACTIVE' && (
                        <Button size="small" color="error" onClick={() => setReversing(p)}>Reverse</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!list.isLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No payments in this period
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination component="div" count={list.data?.totalElements ?? 0}
              page={page} onPageChange={(_, p) => setPage(p)}
              rowsPerPage={size} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}
              rowsPerPageOptions={[20, 50, 100]} />
          </TableContainer>
        </>
      )}

      <Dialog open={!!reversing} onClose={closeReverse} maxWidth="xs" fullWidth>
        <DialogTitle>Reverse payment</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {reversing && `${inr(reversing.amount)} from ${reversing.customerName} (${reversing.method}). `}
            The bill's due amount goes back up. The payment stays on record as reversed; nothing is deleted.
          </Typography>
          {reverseError && <Alert severity="error" sx={{ mb: 2 }}>{reverseError}</Alert>}
          <TextField label="Reason" fullWidth autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReverse}>Keep payment</Button>
          <Button color="error" variant="contained" disabled={!reason.trim() || reverse.isPending}
            onClick={() => { setReverseError(''); reverse.mutate() }}>
            Reverse
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}