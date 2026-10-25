import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { api, errorMessage } from '../../api/client'
import type { Branding } from '../../api/types'
import { faviconUrl, useBranding } from '../../hooks/useBranding'

export default function BrandingCard() {
  const qc = useQueryClient()
  const { data } = useBranding()
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (data) setName(data.appName) }, [data])

  const done = (b: Branding, text: string) => {
    qc.setQueryData(['branding'], b)
    setMsg({ type: 'success', text })
  }
  const fail = (e: unknown) => setMsg({ type: 'error', text: errorMessage(e) })

  const rename = useMutation({
    mutationFn: async () => (await api.put<Branding>('/branding', { appName: name.trim() })).data,
    onSuccess: (b) => done(b, 'Name saved'),
    onError: fail,
  })
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return (await api.post<Branding>('/branding/favicon', body, { headers: { 'Content-Type': 'multipart/form-data' } })).data
    },
    onSuccess: (b) => done(b, 'Icon saved'),
    onError: fail,
  })
  const clear = useMutation({
    mutationFn: async () => (await api.delete<Branding>('/branding/favicon')).data,
    onSuccess: (b) => done(b, 'Icon removed'),
    onError: fail,
  })

  const pick = (file: File | undefined) => {
    if (!file) return
    if (file.size > 100 * 1024) { setMsg({ type: 'error', text: 'Image must be 100 KB or smaller' }); return }
    setMsg(null)
    upload.mutate(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Paper sx={{ p: 2, mb: 2, display: 'grid', gap: 2 }}>
      <Typography variant="h6">App name and icon</Typography>
      <Typography variant="body2" color="text.secondary">
        The name shows in the menu bar, on the login page and on the browser tab. The icon shows on the browser tab.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField label="App name" value={name} onChange={(e) => { setName(e.target.value); setMsg(null) }}
          error={!name.trim()} helperText={!name.trim() ? 'Required' : 'Up to 60 characters'}
          slotProps={{ htmlInput: { maxLength: 60 } }} sx={{ minWidth: 280 }} />
        <Button variant="contained" sx={{ mt: 1 }} disabled={!name.trim() || name.trim() === data?.appName || rename.isPending}
          onClick={() => rename.mutate()}>Save name</Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ width: 48, height: 48, border: 1, borderColor: 'divider', borderRadius: 1, display: 'grid', placeItems: 'center' }}>
          {data?.hasFavicon
            ? <img src={faviconUrl(data)} alt="icon" style={{ maxWidth: 40, maxHeight: 40 }} />
            : <Typography variant="caption" color="text.secondary">none</Typography>}
        </Box>
        <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/x-icon,.ico"
          onChange={(e) => pick(e.target.files?.[0])} />
        <Button variant="outlined" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
          {data?.hasFavicon ? 'Change icon' : 'Upload icon'}
        </Button>
        {data?.hasFavicon && <Button color="inherit" disabled={clear.isPending} onClick={() => clear.mutate()}>Remove icon</Button>}
        <Typography variant="caption" color="text.secondary">Square PNG, 64×64 or larger, up to 100 KB</Typography>
      </Box>
      {msg && <Alert severity={msg.type}>{msg.text}</Alert>}
    </Paper>
  )
}