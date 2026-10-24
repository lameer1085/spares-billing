import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Paper, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import {
  inr, type BalanceResponse, type Customer, type InvoiceSummary, type PageResponse, type PayMethod,
  type PaymentResult,
} from '../../api/types'
import CustomerPicker from '../billing/CustomerPicker'

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export default function ReceivePaymentCard() {
  const qc = useQueryClient()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayMethod>('CASH')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(todayIST())
  const [notes, setNotes] = useState('')
  const [advance, setAdvance] = useState(false)
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PaymentResult | null>(null)

  const balance = useQuery({
    queryKey: ['balance', customer?.id],
    enabled: !!customer,
    queryFn: async () => (await api.get<BalanceResponse>(`/customers/${customer!.id}/balance`)).data,
  })

  const openInvoices = useQuery({
    queryKey: ['open-invoices', customer?.id],
    enabled: !!customer,
    queryFn: async () => {
      const rows = (await api.get<PageResponse<InvoiceSummary>>('/invoices', {
        params: { customerId: customer!.id, status: 'ACTIVE', size: 100 },
      })).data.content
      return rows.filter((r) => r.dueAmount > 0).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.id - b.id)
    },
  })

  const chosenInvoice = openInvoices.data?.find((i) => String(i.id) === invoiceId)
  const owes = balance.data?.balance ?? 0
  const amt = Number(amount)

  // Live message under the Amount box
  let amountError = ''
  if (amount !== '' || touched) {
    if (amount === '' || isNaN(amt) || amt <= 0) amountError = 'Enter an amount above 0'
    else if (chosenInvoice && amt > chosenInvoice.dueAmount)
      amountError = `More than this bill's due (${inr(chosenInvoice.dueAmount)})`
    else if (!chosenInvoice && !advance && customer && balance.data && amt > Math.max(owes, 0))
      amountError = owes > 0
        ? `More than he owes (${inr(owes)}). Tick "Advance" to accept extra.`
        : 'He owes nothing. Tick "Advance" to record this as advance.'
  }
  const customerError = touched && !customer ? 'Choose a customer' : ''

  const pay = useMutation({
    mutationFn: async () =>
      (await api.post<PaymentResult>('/payments', {
        customerId: customer!.id,
        invoiceId: invoiceId ? Number(invoiceId) : null,
        amount: amt,
        method,
        reference: reference.trim() || null,
        paymentDate: date || null,
        notes: notes.trim() || null,
        advance,
      })).data,
    onSuccess: (r) => {
      setResult(r)
      for (const k of ['payments', 'payment-summary', 'balance', 'dues', 'invoices', 'open-invoices', 'invoice'])
        qc.invalidateQueries({ queryKey: [k] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const submit = () => {
    setTouched(true)
    setError('')
    if (!customer || amountError || amount === '' || amt <= 0) return
    pay.mutate()
  }

  const reset = () => {
    setResult(null)
    setCustomer(null)
    setInvoiceId('')
    setAmount('')
    setReference('')
    setNotes('')
    setAdvance(false)
    setTouched(false)
    setError('')
    setDate(todayIST())
  }

  const fillDue = () => {
    const v = chosenInvoice ? chosenInvoice.dueAmount : Math.max(owes, 0)
    if (v > 0) setAmount(String(v))
  }

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>Receive payment</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Box>
          <CustomerPicker label="Customer" value={customer}
            onChange={(c) => { setCustomer(c); setInvoiceId(''); setAmount('') }} />
          {customerError && <Typography variant="caption" color="error">{customerError}</Typography>}
        </Box>

        <TextField select label="Settle which bill?" value={invoiceId} disabled={!customer}
          onChange={(e) => setInvoiceId(e.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Oldest bills first (recommended)</MenuItem>
          {openInvoices.data?.map((i) => (
            <MenuItem key={i.id} value={String(i.id)}>
              {i.invoiceNo} · due {inr(i.dueAmount)}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField label="Amount received" type="number" fullWidth value={amount}
            onChange={(e) => setAmount(e.target.value)} error={!!amountError} helperText={amountError} />
          <Button sx={{ mt: 1, whiteSpace: 'nowrap' }} disabled={!customer} onClick={fillDue}>Fill due</Button>
        </Box>

        <TextField select label="Method" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
          {(['CASH', 'UPI', 'CARD', 'BANK'] as PayMethod[]).map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>

        <TextField label="Reference (UPI ref, cheque no.)" value={reference} onChange={(e) => setReference(e.target.value)} />
        <TextField label="Payment date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIST() } }} />
        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <FormControlLabel
          control={<Checkbox checked={advance} disabled={!!invoiceId} onChange={(e) => setAdvance(e.target.checked)} />}
          label="Advance: accept more than he owes" />
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Button variant="contained" size="large" sx={{ mt: 2 }} onClick={submit} disabled={pay.isPending}>
        {pay.isPending ? 'Saving…' : 'Receive payment'}
      </Button>

      <Dialog open={!!result} onClose={reset} maxWidth="xs" fullWidth>
        <DialogTitle>Payment received</DialogTitle>
        <DialogContent>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{inr(result?.amount)}</Typography>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>Applied to</Typography>
          {result?.allocations.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>{a.invoiceNo ?? 'On account (advance)'}</Typography>
              <Typography>{inr(a.amount)}</Typography>
            </Box>
          ))}
          <Typography sx={{ mt: 2 }}>
            {(result?.customerBalance ?? 0) > 0
              ? `Customer still owes ${inr(result?.customerBalance)}`
              : (result?.customerBalance ?? 0) < 0
                ? `Advance on account: ${inr(-(result?.customerBalance ?? 0))}`
                : 'Nothing outstanding now'}
          </Typography>
        </DialogContent>
        <DialogActions><Button variant="contained" autoFocus onClick={reset}>Done</Button></DialogActions>
      </Dialog>
    </Paper>
  )
}