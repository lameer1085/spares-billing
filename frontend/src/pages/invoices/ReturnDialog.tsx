import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Table,
  TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type CreditNoteFull, type InvoiceFull, type PayMethod } from '../../api/types'

interface Props {
  invoice: InvoiceFull
  creditedBefore: number // total of earlier credit notes on this bill
  onClose: () => void
  onCreated: (creditNoteId: number) => void
}

const r2 = (n: number) => Math.round(n * 100) / 100

export default function ReturnDialog({ invoice, creditedBefore, onClose, onCreated }: Props) {
  const qc = useQueryClient()
  const walkIn = invoice.customer === null

  const [qty, setQty] = useState<Record<number, string>>({})
  const [restock, setRestock] = useState<Record<number, boolean>>({})
  const [reason, setReason] = useState('')
  const [refund, setRefund] = useState('')
  const [method, setMethod] = useState<PayMethod>('CASH')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')

  const returnable = (productId: number) => {
    const l = invoice.items.find((x) => x.productId === productId)!
    return l.quantity - l.returnedQuantity
  }

  // Estimated value of what is being returned (the server computes the exact figures)
  const rows = invoice.items.map((l) => {
    const q = Number(qty[l.productId]) || 0
    const max = l.quantity - l.returnedQuantity
    return {
      l, q, max,
      bad: q < 0 || !Number.isInteger(q) || q > max,
      value: q > 0 ? (l.lineTotal * q) / l.quantity : 0,
    }
  })
  const estTotal = Math.round(r2(rows.reduce((s, r) => s + r.value, 0)))
  const anyReturn = rows.some((r) => r.q > 0)
  const anyBad = rows.some((r) => r.bad)

  // Same rule as the server: only what he paid beyond the new balance can be refunded
  const newDue = Math.max(0, invoice.grandTotal - (creditedBefore + estTotal))
  const maxRefund = Math.max(0, r2(invoice.paidAmount - newDue))
  const refundNum = Number(refund) || 0

  const reasonError = touched && !reason.trim() ? 'Please enter a reason' : ''
  const refundError =
    !walkIn && refundNum > maxRefund + 0.01
      ? `Only ${inr(maxRefund)} can be refunded. The rest reduces what he owes.`
      : refundNum < 0 ? 'Cannot be negative' : ''
  const itemsError =
    anyBad ? 'A quantity is more than what can still be returned.'
      : touched && !anyReturn ? 'Enter a return quantity for at least one item.' : ''

  const create = useMutation({
    mutationFn: async () =>
      (await api.post<CreditNoteFull>('/credit-notes', {
        invoiceId: invoice.id,
        items: rows.filter((r) => r.q > 0).map((r) => ({
          productId: r.l.productId,
          quantity: r.q,
          restock: restock[r.l.productId] ?? true,
        })),
        reason: reason.trim(),
        refundAmount: walkIn ? null : refundNum,
        refundMethod: method,
      })).data,
    onSuccess: (cn) => {
      for (const k of ['invoice', 'invoices', 'credit-notes', 'products', 'product-pick', 'dues', 'balance',
        'payments', 'payment-summary', 'open-invoices', 'ledger'])
        qc.invalidateQueries({ queryKey: [k] })
      onCreated(cn.id)
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const submit = () => {
    setTouched(true)
    setError('')
    if (!anyReturn || anyBad || !reason.trim() || refundError) return
    create.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Return items: {invoice.invoiceNo}</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Sold</TableCell>
              <TableCell align="right">Returned</TableCell>
              <TableCell align="right" sx={{ width: 100 }}>Return now</TableCell>
              <TableCell align="center">Back in stock?</TableCell>
              <TableCell align="right">Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ l, q, max, bad, value }) => (
              <TableRow key={l.productId}>
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{l.description}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {inr(l.lineTotal / l.quantity)} each, GST included
                  </Typography>
                </TableCell>
                <TableCell align="right">{l.quantity}</TableCell>
                <TableCell align="right">{l.returnedQuantity}</TableCell>
                <TableCell align="right">
                  <TextField size="small" type="number" value={qty[l.productId] ?? ''} error={bad}
                    disabled={max === 0} placeholder={max === 0 ? '—' : `0-${max}`}
                    onChange={(e) => setQty({ ...qty, [l.productId]: e.target.value })}
                    slotProps={{ htmlInput: { min: 0, max, style: { textAlign: 'right' } } }} />
                </TableCell>
                <TableCell align="center">
                  <Checkbox size="small" disabled={q === 0}
                    checked={restock[l.productId] ?? true}
                    onChange={(e) => setRestock({ ...restock, [l.productId]: e.target.checked })} />
                </TableCell>
                <TableCell align="right">{value > 0 ? inr(r2(value)) : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="caption" color="text.secondary">
          Untick "Back in stock?" for damaged parts. They are credited to the customer but not added back to stock.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 3 }}>
          <TextField label="Reason for return" value={reason} onChange={(e) => setReason(e.target.value)}
            sx={{ gridColumn: { sm: '1 / -1' } }} error={!!reasonError} helperText={reasonError} />

          {walkIn ? (
            <Alert severity="info" sx={{ gridColumn: { sm: '1 / -1' } }}>
              Walk-in customer: the full credit amount ({inr(estTotal)}) is refunded now.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField label="Refund paid out now" type="number" fullWidth value={refund}
                onChange={(e) => setRefund(e.target.value)} error={!!refundError}
                helperText={refundError || `Up to ${inr(maxRefund)}. Leave 0 to keep it as credit on his account.`} />
              <Button sx={{ mt: 1, whiteSpace: 'nowrap' }} onClick={() => setRefund(String(maxRefund))}>Max</Button>
            </Box>
          )}

          {(walkIn || refundNum > 0) && (
            <TextField select label="Refund method" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
              {(['CASH', 'UPI', 'CARD', 'BANK'] as PayMethod[]).map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
          )}
        </Box>

        <Box sx={{ mt: 2, textAlign: 'right' }}>
          <Typography variant="h6">Credit total ≈ {inr(estTotal)}</Typography>
          <Typography variant="caption" color="text.secondary">
            Estimate. The saved credit note shows the exact GST split and rounding.
          </Typography>
        </Box>

        {itemsError && <Alert severity="error" sx={{ mt: 2 }}>{itemsError}</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Create credit note'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}