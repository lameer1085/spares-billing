import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem,
  ListItemText, Tab, Tabs, TextField, Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { api, errorMessage } from '../../api/client'
import type { NameItem } from '../../api/types'

type Kind = 'brands' | 'categories'

function NameList({ kind, singular }: { kind: Kind; singular: string }) {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')

  const list = useQuery({
    queryKey: [kind],
    queryFn: async () => (await api.get<NameItem[]>(`/${kind}`)).data,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['brands'] })
    qc.invalidateQueries({ queryKey: ['categories'] })
    qc.invalidateQueries({ queryKey: ['products'] })
  }

  const add = useMutation({
    mutationFn: () => api.post(`/${kind}`, { name: newName.trim() }),
    onSuccess: () => { setNewName(''); setError(''); refresh() },
    onError: (e) => setError(errorMessage(e)),
  })
  const rename = useMutation({
    mutationFn: () => api.put(`/${kind}/${editId}`, { name: editName.trim() }),
    onSuccess: () => { setEditId(null); setError(''); refresh() },
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <TextField size="small" fullWidth autoFocus placeholder={`New ${singular} name`} value={newName}
          onChange={(e) => { setNewName(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim() && !add.isPending) add.mutate() }}
          slotProps={{ htmlInput: { maxLength: 100 } }} />
        <Button variant="contained" disabled={!newName.trim() || add.isPending} onClick={() => add.mutate()}>
          Add
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
      <List dense sx={{ maxHeight: 360, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        {list.data?.map((i) => (
          <ListItem key={i.id} divider
            secondaryAction={editId === i.id ? (
              <>
                <Tooltip title="Save"><span>
                  <IconButton size="small" disabled={!editName.trim() || rename.isPending} onClick={() => rename.mutate()}>
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </span></Tooltip>
                <IconButton size="small" onClick={() => { setEditId(null); setError('') }}><CloseIcon fontSize="small" /></IconButton>
              </>
            ) : (
              <Tooltip title="Rename">
                <IconButton size="small" onClick={() => { setEditId(i.id); setEditName(i.name); setError('') }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}>
            {editId === i.id ? (
              <TextField size="small" autoFocus value={editName} sx={{ mr: 8 }} fullWidth
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && editName.trim()) rename.mutate() }} />
            ) : (
              <ListItemText primary={i.name} />
            )}
          </ListItem>
        ))}
        {list.data?.length === 0 && <ListItem><ListItemText secondary={`No ${kind} yet`} /></ListItem>}
      </List>
    </Box>
  )
}

export default function NameManagerDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Kind>('brands')
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Brands and categories</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="brands" label="Brands" />
          <Tab value="categories" label="Categories" />
        </Tabs>
        {tab === 'brands' ? <NameList key="b" kind="brands" singular="brand" />
                          : <NameList key="c" kind="categories" singular="category" />}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  )
}