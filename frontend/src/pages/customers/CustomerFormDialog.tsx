import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import type { Customer, StateItem } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'

interface Props {
  customer: Customer | null // null = create
  states: StateItem[]
  onClose: () => void
}

const makeInitial = (c: Customer | null) => ({
  name: c?.name ?? '',
  phone: c?.phone ?? '',
  gstin: c?.gstin ?? '',
  stateCode: c?.stateCode ?? '',
  address: c?.address ?? '',
  creditLimit: c?.creditLimit?.toString() ?? '0',
  openingBalance: c?.openingBalance?.toString() ?? '0',
})
type Form = ReturnType<typeof makeInitial>
type Field = keyof Form
type Errors = Partial<Record<Field, string>>
const FIELDS = Object.keys(makeInitial(null)) as Field[]

const KEYWORDS: [RegExp, Field][] = [
  [/gstin/i, 'gstin'],
  [/phone/i, 'phone'],
  [/state/i, 'stateCode'],
  [/credit/i, 'creditLimit'],
  [/opening/i, 'openingBalance'],
  [/name/i, 'name'],
  [/address/i, 'address'],
]

function splitServerMessage(msg: string): { errors: Errors; general: string[] } {
  const errors: Errors = {}
  const general: string[] = []
  for (const raw of msg.split(';')) {
    const part = raw.trim()
    if (!part) continue
    const m = /^(\w+):\s*(.*)$/.exec(part)
    if (m && (FIELDS as string[]).includes(m[1])) {
      errors[m[1] as Field] = m[2]
      continue
    }
    const hit = KEYWORDS.find(([re]) => re.test(part))
    if (hit) errors[hit[1]] = part
    else general.push(part)
  }
  return { errors, general }
}

function validate(f: Form, owner: boolean): Errors {
  const e: Errors = {}
  if (!f.name.trim()) e.name = 'Name is required'
  if (f.phone.trim() && !/^\+?[0-9]{8,15}$/.test(f.phone.replace(/[\s-]/g, '')))
    e.phone = 'Enter 8 to 15 digits, for example 9876543210'
  if (f.gstin.trim() && f.gstin.trim().length !== 15) e.gstin = 'GSTIN must be 15 characters'
  if (owner) {
    if (f.creditLimit === '' || isNaN(Number(f.creditLimit)) || Number(f.creditLimit) < 0)
      e.creditLimit = 'Enter 0 or more'
    if (f.openingBalance === '' || isNaN(Number(f.openingBalance)))
      e.openingBalance = 'Enter a number (0 if none)'
  }
  return e
}

export default function CustomerFormDialog({ customer, states, onClose }: Props) {
  const qc = useQueryClient()
  const { isOwner } = useAuth()
  const isEdit = customer !== null
  const [f, setF] = useState<Form>(() => makeInitial(customer))
  const [errors, setErrors] = useState<Errors>({})
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
        // Staff cannot set money fields; the server ignores them, so we don't send them
        creditLimit: isOwner ? Number(f.creditLimit) : null,
        openingBalance: isOwner ? Number(f.openingBalance) : null,
      }
      return isEdit ? api.put(`/customers/${customer!.id}`, body) : api.post('/customers', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['dues'] })
      onClose()
    },
    onError: (e) => {
      const r = splitServerMessage(errorMessage(e))
      setErrors(r.errors)
      setGeneral(r.general)
    },
  })

  const submit = () => {
    setGeneral([])
    const found = validate(f, isOwner)
    setErrors(found)
    if (Object.keys(found).length === 0) save.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `Edit ${customer!.name}` : 'Add customer'}</DialogTitle>
      <DialogContent>
        {general.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>{general.join('. ')}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
          <TextField label="Name" required autoFocus sx={{ gridColumn: { sm: '1 / -1' } }} {...field('name')} />
          <TextField label="Phone" {...field('phone')} />
          <TextField label="GSTIN (optional)" {...field('gstin', 'Leave blank for walk-in or unregistered customers')} />
          <TextField select label="State" sx={{ gridColumn: { sm: '1 / -1' } }}
            {...field('stateCode', 'If a GSTIN is given, the state is taken from it')}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value="">Not set</MenuItem>
            {states.map((s) => <MenuItem key={s.code} value={s.code}>{s.code} · {s.name}</MenuItem>)}
          </TextField>
          <TextField label="Address" multiline minRows={2} sx={{ gridColumn: { sm: '1 / -1' } }} {...field('address')} />
          {isOwner && (
            <>
              <TextField label="Credit limit" type="number"
                {...field('creditLimit', '0 means no credit sales')} />
              <TextField label="Opening balance" type="number"
                {...field('openingBalance', 'Amount he already owes you today')} />
            </>
          )}
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