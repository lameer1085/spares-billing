import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type Customer, type LedgerResponse } from '../../api/types'

export default function LedgerDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger', customer.id, from, to],
    queryFn: async () =>
      (await api.get<LedgerResponse>(`/customers/${customer.id}/ledger`, {
        params: { from: from || undefined, to: to || undefined },
      })).data,
  })

  const owes = (data?.closingBalance ?? 0) > 0
  const advance = (data?.closingBalance ?? 0) < 0

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Statement: {customer.name}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 1 }}>
          <TextField size="small" type="date" label="From" value={from}
            onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="To" value={to}
            onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        {isLoading && <CircularProgress />}
        {error && <Alert severity="error">{errorMessage(error)}</Alert>}
        {data && (
          <>
            <Typography sx={{ mb: 1 }}>
              Opening {inr(data.openingBalance)} · Billed {inr(data.totalDebit)} · Received/credited {inr(data.totalCredit)}
            </Typography>
            <Alert severity={owes ? 'warning' : advance ? 'info' : 'success'} sx={{ mb: 2 }}>
              {owes && `Customer owes you ${inr(data.closingBalance)}`}
              {advance && `You owe the customer ${inr(-data.closingBalance)} (advance paid)`}
              {!owes && !advance && 'Nothing outstanding'}
            </Alert>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.entries.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>{e.type}</TableCell>
                    <TableCell>{e.reference}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell align="right">{e.debit ? inr(e.debit) : ''}</TableCell>
                    <TableCell align="right">{e.credit ? inr(e.credit) : ''}</TableCell>
                    <TableCell align="right">{inr(e.balance)}</TableCell>
                  </TableRow>
                ))}
                {data.entries.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>
                    No transactions in this period
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  )
}