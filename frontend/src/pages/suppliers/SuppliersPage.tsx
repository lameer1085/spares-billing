import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, IconButton, InputAdornment, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import EditIcon from '@mui/icons-material/Edit'
import BlockIcon from '@mui/icons-material/Block'
import RestoreIcon from '@mui/icons-material/Restore'
import { api, errorMessage } from '../../api/client'
import { inr, type PageResponse, type StateItem, type Supplier, type SupplierDue } from '../../api/types'
import { useDebounce } from '../../hooks/useDebounce'
import SupplierFormDialog from './SupplierFormDialog'

export default function SuppliersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [formFor, setFormFor] = useState<Supplier | 'new' | null>(null)
  const [actionError, setActionError] = useState('')
  const q = useDebounce(search.trim())

  const states = useQuery({
    queryKey: ['states'], staleTime: Infinity,
    queryFn: async () => (await api.get<StateItem[]>('/states')).data,
  })
  const suppliers = useQuery({
    queryKey: ['suppliers', q, includeInactive, page, size],
    queryFn: async () =>
      (await api.get<PageResponse<Supplier>>('/suppliers', { params: { q: q || undefined, includeInactive, page, size } })).data,
    placeholderData: keepPreviousData,
  })
  const dues = useQuery({
    queryKey: ['purchase-dues'],
    queryFn: async () => (await api.get<SupplierDue[]>('/purchases/dues')).data,
  })
  const dueById = new Map(dues.data?.map((d) => [d.supplierId, d.due]) ?? [])

  const toggle = useMutation({
    mutationFn: (s: Supplier) => api.patch(`/suppliers/${s.id}/active`, null, { params: { value: !s.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
    onError: (e) => setActionError(errorMessage(e)),
  })

  const rows = suppliers.data?.content ?? []

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Suppliers</Typography>
        <Button variant="contained" onClick={() => setFormFor('new')}>Add supplier</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField autoFocus size="small" sx={{ minWidth: 320, flexGrow: 1 }}
          placeholder="Search name, phone or GSTIN" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        <FormControlLabel label="Show inactive"
          control={<Checkbox checked={includeInactive} onChange={(e) => { setIncludeInactive(e.target.checked); setPage(0) }} />} />
      </Paper>

      {suppliers.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(suppliers.error)}</Alert>}
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell><TableCell>Phone</TableCell><TableCell>GSTIN</TableCell>
              <TableCell>State</TableCell><TableCell align="right">You owe</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((s) => {
              const due = dueById.get(s.id) ?? 0
              return (
                <TableRow key={s.id} hover sx={{ opacity: s.active ? 1 : 0.5 }}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {s.name} {!s.active && <Chip size="small" label="Inactive" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{s.phone}</TableCell>
                  <TableCell>{s.gstin}</TableCell>
                  <TableCell>{s.stateName}</TableCell>
                  <TableCell align="right" sx={{ color: due > 0 ? 'warning.dark' : undefined, fontWeight: due > 0 ? 600 : 400 }}>
                    {due > 0 ? inr(due) : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => setFormFor(s)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={s.active ? 'Deactivate' : 'Activate'}>
                      <IconButton size="small" onClick={() => toggle.mutate(s)}>
                        {s.active ? <BlockIcon fontSize="small" /> : <RestoreIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
            {!suppliers.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No suppliers found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={suppliers.data?.totalElements ?? 0}
          page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={size} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}
          rowsPerPageOptions={[20, 50, 100]} />
      </TableContainer>

      {formFor && (
        <SupplierFormDialog key={formFor === 'new' ? 'new' : formFor.id}
          supplier={formFor === 'new' ? null : formFor} states={states.data ?? []} onClose={() => setFormFor(null)} />
      )}
    </>
  )
}