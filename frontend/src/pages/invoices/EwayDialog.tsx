import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type EwayDetails, type InvoiceFull } from '../../api/types'
import { splitServerMessage } from '../../utils/formErrors'
import { buildEwayJson, ewayNeeded, LIMIT_OTHER_STATE, LIMIT_SAME_STATE, type EwayForm } from './ewayJson'

type FieldKey = 'toPincode' | 'vehicleNo' | 'transporterId' | 'ewayBillNo' | 'distanceKm'
const FIELDS: FieldKey[] = ['toPincode', 'vehicleNo', 'transporterId', 'ewayBillNo', 'distanceKm']
const KEYWORDS: [RegExp, FieldKey][] = [
  [/pincode/i, 'toPincode'], [/vehicle/i, 'vehicleNo'], [/transporter id/i, 'transporterId'],
  [/e-way bill number/i, 'ewayBillNo'],
]
const FROM_KEY = 'spares_eway_from_place'

const fromDetails = (d: EwayDetails | undefined): EwayForm => ({
  toPincode: d?.toPincode ?? '', toPlace: d?.toPlace ?? '', distanceKm: d?.distanceKm != null ? String(d.distanceKm) : '',
  transMode: String(d?.transMode ?? 1), vehicleNo: d?.vehicleNo ?? '', transporterName: d?.transporterName ?? '',
  transporterId: d?.transporterId ?? '', transDocNo: d?.transDocNo ?? '', transDocDate: d?.transDocDate ?? '',
  ewayBillNo: d?.ewayBillNo ?? '', ewayBillDate: d?.ewayBillDate ?? '',
  fromPlace: (() => { try { return localStorage.getItem(FROM_KEY) ?? 'Kadayanallur' } catch { return 'Kadayanallur' } })(),
})

export default function EwayDialog({ inv, onClose }: { inv: InvoiceFull; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState<EwayForm | null>(null)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [general, setGeneral] = useState<string[]>([])
  const [problems, setProblems] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  const q = useQuery({
    queryKey: ['eway', inv.id],
    queryFn: async () => (await api.get<EwayDetails>(`/invoices/${inv.id}/eway`)).data,
  })
  useEffect(() => { if (q.data && !f) setF(fromDetails(q.data)) }, [q.data, f])

  const save = useMutation({
    mutationFn: async (v: EwayForm) =>
      (await api.put<EwayDetails>(`/invoices/${inv.id}/eway`, {
        toPincode: v.toPincode.trim(), toPlace: v.toPlace.trim(),
        distanceKm: v.distanceKm === '' ? null : Number(v.distanceKm),
        transMode: Number(v.transMode), vehicleNo: v.vehicleNo.replace(/\s+/g, ''),
        transporterName: v.transporterName.trim(), transporterId: v.transporterId.trim(),
        transDocNo: v.transDocNo.trim(), transDocDate: v.transDocDate || null,
        ewayBillNo: v.ewayBillNo.trim(), ewayBillDate: v.ewayBillDate || null,
      })).data,
    onSuccess: (d) => {
      try { localStorage.setItem(FROM_KEY, f?.fromPlace ?? '') } catch { /* ignore */ }
      qc.setQueryData(['eway', inv.id], d)
      setErrors({}); setGeneral([]); setSaved(true)
    },
    onError: (e) => {
      const r = splitServerMessage(errorMessage(e), FIELDS, KEYWORDS)
      setErrors(r.errors); setGeneral(r.general); setSaved(false)
    },
  })

  if (!f) return null
  const set = (k: keyof EwayForm, v: string) => {
    setF({ ...f, [k]: v }); setSaved(false)
    if (k in errors) setErrors({ ...errors, [k]: undefined })
  }
  const text = (k: keyof EwayForm, label: string, extra: object = {}) => (
    <TextField size="small" label={label} value={f[k]} onChange={(e) => set(k, e.target.value)}
      error={!!errors[k as FieldKey]} helperText={errors[k as FieldKey]} {...extra} />
  )

  const download = () => {
    const r = buildEwayJson(inv, f)
    setProblems(r.problems)
    if (!r.json) return
    const blob = new Blob([JSON.stringify(r.json, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eway-${inv.invoiceNo.replace(/[^A-Za-z0-9-]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const needed = ewayNeeded(inv)
  const same = inv.placeOfSupply === inv.shop.stateCode

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>E-way bill · {inv.invoiceNo}</DialogTitle>
      <DialogContent>
        <Alert severity={needed ? 'warning' : 'info'} sx={{ mb: 2 }}>
          {needed
            ? `This bill (${inr(inv.grandTotal)}) is above the ${same ? 'in-state' : 'other-state'} limit of ${inr(same ? LIMIT_SAME_STATE : LIMIT_OTHER_STATE)}, so an e-way bill is needed before the goods move.`
            : `This bill is below the limit. Check with your CA: several bills to one buyer on the same day can count as one consignment.`}
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>1. Delivery</Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, mb: 2 }}>
          {text('fromPlace', 'Dispatch from (your town)')}
          {text('toPlace', 'Deliver to (town)', { required: true })}
          {text('toPincode', 'Buyer pincode', { required: true })}
          {text('distanceKm', 'Distance in km', { type: 'number', helperText: errors.distanceKm ?? 'Leave empty or 0 to let the portal work it out' })}
        </Box>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>2. Transport (Part B, can also be filled on the portal later)</Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, mb: 2 }}>
          <TextField select size="small" label="Mode" value={f.transMode} onChange={(e) => set('transMode', e.target.value)}>
            <MenuItem value="1">Road</MenuItem><MenuItem value="2">Rail</MenuItem>
            <MenuItem value="3">Air</MenuItem><MenuItem value="4">Ship</MenuItem>
          </TextField>
          {text('vehicleNo', 'Vehicle number', { helperText: errors.vehicleNo ?? 'e.g. TN76AB1234' })}
          {text('transporterName', 'Transporter name')}
          {text('transporterId', 'Transporter ID (GSTIN)')}
          {text('transDocNo', 'Lorry receipt / transport doc no')}
          {text('transDocDate', 'Transport doc date', { type: 'date', slotProps: { inputLabel: { shrink: true } } })}
        </Box>

        {problems.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>{problems.join('. ')}</Alert>}
        <Button variant="outlined" onClick={download}>Download JSON for the portal</Button>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          On the portal: E-Waybill, Generate in Bulk, upload this file. It gives you a 12-digit number.
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>3. E-way bill number from the portal</Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
          {text('ewayBillNo', 'E-way bill number (12 digits)')}
          {text('ewayBillDate', 'Generated on', { type: 'date', slotProps: { inputLabel: { shrink: true } } })}
        </Box>

        {general.length > 0 && <Alert severity="error" sx={{ mt: 2 }}>{general.join('. ')}</Alert>}
        {saved && <Alert severity="success" sx={{ mt: 2 }}>Saved</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate(f)}>
          {save.isPending ? 'Saving…' : 'Save details'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}