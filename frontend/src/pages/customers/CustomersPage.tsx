import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, IconButton, InputAdornment, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import EditIcon from '@mui/icons-material/Edit'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import BlockIcon from '@mui/icons-material/Block'
import RestoreIcon from '@mui/icons-material/Restore'
import { api, errorMessage } from '../../api/client'
import { inr, type Customer, type DuesResponse, type PageResponse, type StateItem } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import CustomerFormDialog from './CustomerFormDialog'
import LedgerDialog from './LedgerDialog'

export default function CustomersPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [formFor, setFormFor] = useState<Customer | 'new' | null>(null)
  const [ledgerFor, setLedgerFor] = useState<Customer | null>(null)
  const [actionError, setActionError] = useState('')
  const q = useDebounce(search.trim())

  const states = useQuery({
    queryKey: ['states'],
    queryFn: async () => (await api.get<StateItem[]>('/states')).data,
    staleTime: Infinity,
  })

  const customers = useQuery({
    queryKey: ['customers', q, includeInactive, page, size],
    queryFn: async () =>
      (await api.get<PageResponse<Customer>>('/customers', {
        params: { q: q || undefined, includeInactive, page, size },
      })).data,
    placeholderData: keepPreviousData,
  })

  // Amount each customer owes (Owner only). Customers not listed owe nothing.
  const dues = useQuery({
    queryKey: ['dues'],
    enabled: isOwner,
    queryFn: async () => (await api.get<DuesResponse>('/ledger/dues')).data,
  })
  const dueById = new Map(dues.data?.customers.map((d) => [d.customerId, d.balance]) ?? [])

  const toggleActive = useMutation({
    mutationFn: (c: Customer) => api.patch(`/customers/${c.id}/active`, null, { params: { value: !c.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
    onError: (e) => setActionError(errorMessage(e)),
  })

  const rows = customers.data?.content ?? []
  const cols = isOwner ? 8 : 5

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Customers</Typography>
        {isOwner && dues.data && (
          <Chip color="warning" label={`Total outstanding: ${inr(dues.data.totalOutstanding)}`} />
        )}
        <Button variant="contained" onClick={() => setFormFor('new')}>Add customer</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField autoFocus size="small" sx={{ minWidth: 320, flexGrow: 1 }}
          placeholder="Search name, phone or GSTIN"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        {isOwner && (
          <FormControlLabel label="Show inactive"
            control={<Checkbox checked={includeInactive}
              onChange={(e) => { setIncludeInactive(e.target.checked); setPage(0) }} />} />
        )}
      </Paper>

      {customers.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(customers.error)}</Alert>}
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>GSTIN</TableCell>
              <TableCell>State</TableCell>
              {isOwner && <TableCell align="right">Credit limit</TableCell>}
              {isOwner && <TableCell align="right">Owes</TableCell>}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => {
              const owes = dueById.get(c.id) ?? 0
              return (
                <TableRow key={c.id} hover sx={{ opacity: c.active ? 1 : 0.5 }}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {c.name} {!c.active && <Chip size="small" label="Inactive" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.gstin}</TableCell>
                  <TableCell>{c.stateName}</TableCell>
                  {isOwner && <TableCell align="right">{inr(c.creditLimit)}</TableCell>}
                  {isOwner && (
                    <TableCell align="right" sx={{ color: owes > 0 ? 'warning.dark' : undefined, fontWeight: owes > 0 ? 600 : 400 }}>
                      {owes > 0 ? inr(owes) : '—'}
                    </TableCell>
                  )}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Statement"><IconButton size="small" onClick={() => setLedgerFor(c)}><ReceiptLongIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => setFormFor(c)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    {isOwner && (
                      <Tooltip title={c.active ? 'Deactivate' : 'Activate'}>
                        <IconButton size="small" onClick={() => toggleActive.mutate(c)}>
                          {c.active ? <BlockIcon fontSize="small" /> : <RestoreIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {!customers.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={cols + 1} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No customers found
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={customers.data?.totalElements ?? 0}
          page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={size} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}
          rowsPerPageOptions={[20, 50, 100]} />
      </TableContainer>

      {formFor && (
        <CustomerFormDialog key={formFor === 'new' ? 'new' : formFor.id}
          customer={formFor === 'new' ? null : formFor}
          states={states.data ?? []} onClose={() => setFormFor(null)} />
      )}
      {ledgerFor && <LedgerDialog customer={ledgerFor} onClose={() => setLedgerFor(null)} />}
    </>
  )
}