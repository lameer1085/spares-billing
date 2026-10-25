import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem,
  Paper, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import type { AppUser } from '../../api/types'
import { splitServerMessage } from '../../utils/formErrors'

type FieldKey = 'username' | 'password' | 'fullName'
const FIELDS: FieldKey[] = ['username', 'password', 'fullName']
const KEYWORDS: [RegExp, FieldKey][] = [[/username/i, 'username'], [/password/i, 'password']]

export default function UsersPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [resetting, setResetting] = useState<AppUser | null>(null)

  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<AppUser[]>('/users')).data,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Users</Typography>
        <Button variant="contained" onClick={() => setAdding(true)}>Add user</Button>
      </Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        New and reset accounts must choose their own password at the next login. Staff cannot see purchase
        prices, reports, suppliers or settings.
      </Alert>
      {users.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(users.error)}</Alert>}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell><TableCell>Name</TableCell><TableCell>Role</TableCell>
              <TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.data?.map((u) => (
              <TableRow key={u.id} sx={{ opacity: u.active ? 1 : 0.5 }}>
                <TableCell sx={{ fontWeight: 600 }}>{u.username}</TableCell>
                <TableCell>{u.fullName}</TableCell>
                <TableCell><Chip size="small" label={u.role} color={u.role === 'OWNER' ? 'primary' : 'default'} /></TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" color={u.active ? 'success' : 'error'}
                    label={u.active ? 'Active' : 'Deactivated'} />
                  {u.mustChangePassword && <Chip size="small" sx={{ ml: 1 }} color="warning" variant="outlined" label="Must change password" />}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setEditing(u)}>Edit</Button>
                  <Button size="small" onClick={() => setResetting(u)}>Reset password</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {adding && <AddDialog onClose={() => setAdding(false)} onSaved={() => { setAdding(false); refresh() }} />}
      {editing && <EditDialog user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} onSaved={() => { setResetting(null); refresh() }} />}
    </>
  )
}

function AddDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ username: '', password: '', fullName: '', role: 'STAFF' })
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [general, setGeneral] = useState<string[]>([])

  const save = useMutation({
    mutationFn: () => api.post('/users', { ...f, username: f.username.trim(), fullName: f.fullName.trim() }),
    onSuccess: onSaved,
    onError: (e) => {
      const r = splitServerMessage(errorMessage(e), FIELDS, KEYWORDS)
      setErrors(r.errors); setGeneral(r.general)
    },
  })
  const set = (k: keyof typeof f, v: string) => {
    setF({ ...f, [k]: v })
    if (k in errors) setErrors({ ...errors, [k as FieldKey]: undefined })
  }
  const submit = () => {
    const e: Partial<Record<FieldKey, string>> = {}
    if (!f.username.trim()) e.username = 'Username is required'
    if (!f.fullName.trim()) e.fullName = 'Name is required'
    if (f.password.length < 8) e.password = 'At least 8 characters'
    setErrors(e); setGeneral([])
    if (Object.keys(e).length === 0) save.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add user</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField label="Username" required value={f.username} onChange={(e) => set('username', e.target.value)}
          error={!!errors.username} helperText={errors.username} autoFocus />
        <TextField label="Full name" required value={f.fullName} onChange={(e) => set('fullName', e.target.value)}
          error={!!errors.fullName} helperText={errors.fullName} />
        <TextField select label="Role" value={f.role} onChange={(e) => set('role', e.target.value)}
          helperText={f.role === 'OWNER' ? 'Owners see everything, including purchase prices and reports' : 'Staff can bill, quote and take payments'}>
          <MenuItem value="STAFF">Staff</MenuItem>
          <MenuItem value="OWNER">Owner</MenuItem>
        </TextField>
        <TextField label="Temporary password" required type="text" autoComplete="off" value={f.password}
          onChange={(e) => set('password', e.target.value)} error={!!errors.password}
          helperText={errors.password ?? 'They must change it at first login'} />
        {general.length > 0 && <Alert severity="error">{general.join('. ')}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={save.isPending}>Create</Button>
      </DialogActions>
    </Dialog>
  )
}

function EditDialog({ user, onClose, onSaved }: { user: AppUser; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user.fullName)
  const [role, setRole] = useState<string>(user.role)
  const [active, setActive] = useState(user.active)
  const [error, setError] = useState('')

  const save = useMutation({
    mutationFn: () => api.put(`/users/${user.id}`, { fullName: fullName.trim(), role, active }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit {user.username}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)}
          error={!fullName.trim()} helperText={!fullName.trim() ? 'Name is required' : undefined} />
        <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          <MenuItem value="STAFF">Staff</MenuItem>
          <MenuItem value="OWNER">Owner</MenuItem>
        </TextField>
        <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
          label={active ? 'Active: can log in' : 'Deactivated: cannot log in'} />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!fullName.trim() || save.isPending}
          onClick={() => { setError(''); save.mutate() }}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

function ResetDialog({ user, onClose, onSaved }: { user: AppUser; onClose: () => void; onSaved: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: () => api.post(`/users/${user.id}/reset-password`, { newPassword: pw }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e)),
  })
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Reset password for {user.username}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField label="Temporary password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)}
          error={pw.length > 0 && pw.length < 8} helperText="At least 8 characters. They must change it at next login." />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={pw.length < 8 || save.isPending}
          onClick={() => { setError(''); save.mutate() }}>Reset</Button>
      </DialogActions>
    </Dialog>
  )
}