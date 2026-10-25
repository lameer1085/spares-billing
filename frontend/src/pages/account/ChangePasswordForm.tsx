import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, TextField } from '@mui/material'
import { api, errorMessage } from '../../api/client'

export default function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const save = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setOk(true); setCurrent(''); setNext(''); setAgain(''); setError('')
      qc.invalidateQueries({ queryKey: ['me'] })
      onDone?.()
    },
    onError: (e) => { setError(errorMessage(e)); setOk(false) },
  })

  const submit = () => {
    setOk(false)
    if (next.length < 8) return setError('New password must be at least 8 characters')
    if (next !== again) return setError('The two new passwords do not match')
    setError('')
    save.mutate()
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <TextField label="Current password" type="password" autoComplete="current-password" value={current}
        onChange={(e) => setCurrent(e.target.value)} />
      <TextField label="New password" type="password" autoComplete="new-password" value={next}
        onChange={(e) => setNext(e.target.value)} helperText="At least 8 characters" />
      <TextField label="New password again" type="password" autoComplete="new-password" value={again}
        onChange={(e) => setAgain(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
      {error && <Alert severity="error">{error}</Alert>}
      {ok && <Alert severity="success">Password changed</Alert>}
      <Button variant="contained" onClick={submit} disabled={save.isPending || !current || !next}>
        {save.isPending ? 'Saving…' : 'Change password'}
      </Button>
    </Box>
  )
}