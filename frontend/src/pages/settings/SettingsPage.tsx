import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { api, errorMessage } from '../../api/client'
import type { ShopSettings, StateItem } from '../../api/types'
import { splitServerMessage } from '../../utils/formErrors'

type Form = {
  shopName: string; address: string; phone: string; gstin: string; stateCode: string; pincode: string
  invoicePrefix: string; bankAccountName: string; bankName: string; bankAccountNo: string
  bankIfsc: string; upiId: string
}
type FieldKey = keyof Form

const FIELDS: FieldKey[] = ['shopName', 'phone', 'gstin', 'stateCode', 'pincode', 'invoicePrefix',
  'bankAccountNo', 'bankIfsc']
const KEYWORDS: [RegExp, FieldKey][] = [
  [/gstin/i, 'gstin'], [/state/i, 'stateCode'], [/phone/i, 'phone'], [/pincode/i, 'pincode'],
  [/prefix/i, 'invoicePrefix'], [/ifsc/i, 'bankIfsc'], [/account number/i, 'bankAccountNo'],
]

const toForm = (s: ShopSettings): Form => ({
  shopName: s.shopName, address: s.address ?? '', phone: s.phone ?? '', gstin: s.gstin ?? '',
  stateCode: s.stateCode, pincode: s.pincode ?? '', invoicePrefix: s.invoicePrefix,
  bankAccountName: s.bankAccountName ?? '', bankName: s.bankName ?? '', bankAccountNo: s.bankAccountNo ?? '',
  bankIfsc: s.bankIfsc ?? '', upiId: s.upiId ?? '',
})

export default function SettingsPage() {
  const qc = useQueryClient()
  const [f, setF] = useState<Form | null>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [general, setGeneral] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  const shop = useQuery({
    queryKey: ['shop'],
    queryFn: async () => (await api.get<ShopSettings>('/shop')).data,
  })
  const states = useQuery({
    queryKey: ['states'], staleTime: Infinity,
    queryFn: async () => (await api.get<StateItem[]>('/states')).data,
  })

  useEffect(() => { if (shop.data && !f) setF(toForm(shop.data)) }, [shop.data, f])

  const save = useMutation({
    mutationFn: async (v: Form) =>
      (await api.put<ShopSettings>('/shop', {
        ...v,
        gstin: v.gstin.trim().toUpperCase(),
        bankIfsc: v.bankIfsc.trim().toUpperCase(),
      })).data,
    onSuccess: (s) => {
      qc.setQueryData(['shop'], s)
      qc.invalidateQueries({ queryKey: ['shop'] })
      setF(toForm(s))
      setErrors({}); setGeneral([]); setSaved(true)
    },
    onError: (e) => {
      const r = splitServerMessage(errorMessage(e), FIELDS, KEYWORDS)
      setErrors(r.errors); setGeneral(r.general); setSaved(false)
    },
  })

  if (shop.error) return <Alert severity="error">{errorMessage(shop.error)}</Alert>
  if (!f) return null

  const set = (k: FieldKey, v: string) => {
    setF({ ...f, [k]: v })
    setSaved(false)
    if (errors[k]) setErrors({ ...errors, [k]: undefined })
  }
  const field = (k: FieldKey, label: string, extra: object = {}) => (
    <TextField label={label} value={f[k]} onChange={(e) => set(k, e.target.value)}
      error={!!errors[k]} helperText={errors[k]} {...extra} />
  )

  const submit = () => {
    const e: Partial<Record<FieldKey, string>> = {}
    if (!f.shopName.trim()) e.shopName = 'Shop name is required'
    if (!f.invoicePrefix.trim()) e.invoicePrefix = 'Prefix is required'
    setErrors(e)
    if (Object.keys(e).length === 0) { setGeneral([]); save.mutate(f) }
  }

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Shop settings</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        These details print on every bill, quotation and credit note. Changing the invoice prefix affects only
        new bills.
      </Alert>

      <Paper sx={{ p: 2, mb: 2, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Typography variant="h6" sx={{ gridColumn: '1 / -1' }}>Shop</Typography>
        {field('shopName', 'Shop name', { required: true, sx: { gridColumn: '1 / -1' } })}
        {field('address', 'Address', { multiline: true, minRows: 2, sx: { gridColumn: '1 / -1' } })}
        {field('phone', 'Phone')}
        {field('gstin', 'GSTIN')}
        <TextField select label="State" value={f.stateCode} onChange={(e) => set('stateCode', e.target.value)}
          error={!!errors.stateCode} helperText={errors.stateCode ?? 'Decides CGST+SGST or IGST on every bill'}>
          {states.data?.map((s) => <MenuItem key={s.code} value={s.code}>{s.code} · {s.name}</MenuItem>)}
        </TextField>
        {field('pincode', 'Pincode')}
        {field('invoicePrefix', 'Invoice prefix', { required: true })}
      </Paper>

      <Paper sx={{ p: 2, mb: 2, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Typography variant="h6" sx={{ gridColumn: '1 / -1' }}>Bank details (printed on quotations)</Typography>
        {field('bankAccountName', 'Account holder name')}
        {field('bankName', 'Bank and branch')}
        {field('bankAccountNo', 'Account number')}
        {field('bankIfsc', 'IFSC code')}
        {field('upiId', 'UPI ID (optional)')}
      </Paper>

      {general.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>{general.join('. ')}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Saved</Alert>}
      <Button variant="contained" size="large" onClick={submit} disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save settings'}
      </Button>
    </Box>
  )
}