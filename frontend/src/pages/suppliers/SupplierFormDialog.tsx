import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import type { StateItem, Supplier } from '../../api/types'
import { splitServerMessage } from '../../utils/formErrors'

const makeInitial = (s: Supplier | null) => ({
  name: s?.name ?? '',
  phone: s?.phone ?? '',
  gstin: s?.gstin ?? '',
  stateCode: s?.stateCode ?? '',
  address: s?.address ?? '',
})
type Form = ReturnType<typeof makeInitial>
type Field = keyof Form
const FIELDS = Object.keys(makeInitial(null)) as Field[]
const KEYWORDS: [RegExp, Field][] = [
  [/gstin/i, 'gstin'], [/phone/i, 'phone'], [/state/i, 'stateCode'], [/name/i, 'name'],
]

export default function SupplierFormDialog({ supplier, states, onClose }: {
  supplier: Supplier | null; states: StateItem[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = supplier !== null
  const [f, setF] = useState<Form>(() => makeInitial(supplier))
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [general, setGeneral] = useState<string[]>([])

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[k]) setErrors({ ...errors, [k]: undefined })
  }
  const field = (k: Field, hint?: string) => ({
    value: f[k], onChange: set(k), error: !!errors[k], helperText: errors[k] ?? hint,
  })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: f.name.trim(),
        phone: f.phone.trim() || null,
        gstin: f.gstin.trim().toUpperCase() || null,
        stateCode: f.stateCode || null,
        address: f.address.trim() || null,
      }
      return isEdit ? api.put(`/suppliers/${supplier!.id}`, body) : api.post('/suppliers', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      onClose()
    },
    onError: (e) => {
      const r = splitServerMessage(errorMessage(e), FIELDS, KEYWORDS)
      setErrors(r.errors)
      setGeneral(r.general)
    },
  })

  const submit = () => {
    setGeneral([])
    const e: Partial<Record<Field, string>> = {}
    if (!f.name.trim()) e.name = 'Name is required'
    if (f.phone.trim() && !/^\+?[0-9]{8,15}$/.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter 8 to 15 digits'
    if (f.gstin.trim() && f.gstin.trim().length !== 15) e.gstin = 'GSTIN must be 15 characters'
    setErrors(e)
    if (Object.keys(e).length === 0) save.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `Edit ${supplier!.name}` : 'Add supplier'}</DialogTitle>
      <DialogContent>
        {general.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>{general.join('. ')}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
          <TextField label="Name" required autoFocus sx={{ gridColumn: { sm: '1 / -1' } }} {...field('name')} />
          <TextField label="Phone" {...field('phone')} />
          <TextField label="GSTIN (optional)" {...field('gstin')} />
          <TextField select label="State" sx={{ gridColumn: { sm: '1 / -1' } }}
            {...field('stateCode', 'If a GSTIN is given, the state is taken from it')}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">Not set</MenuItem>
            {states.map((s) => <MenuItem key={s.code} value={s.code}>{s.code} · {s.name}</MenuItem>)}
          </TextField>
          <TextField label="Address" multiline minRows={2} sx={{ gridColumn: { sm: '1 / -1' } }} {...field('address')} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}