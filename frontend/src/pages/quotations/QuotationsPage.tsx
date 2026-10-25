import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, InputAdornment, MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { api, errorMessage } from '../../api/client'
import { inr, type PageResponse, type QuotationSummary } from '../../api/types'
import { useDebounce } from '../../hooks/useDebounce'
import { todayIST } from '../../utils/dates'
import { fmtDate } from '../../utils/format'
import QuotationDialog from './QuotationDialog'

export default function QuotationsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const q = useDebounce(search.trim())
  const openId = params.get('open') ? Number(params.get('open')) : null
  const today = todayIST()

  const list = useQuery({
    queryKey: ['quotations', q, status, from, to, page, size],
    queryFn: async () =>
      (await api.get<PageResponse<QuotationSummary>>('/quotations', {
        params: { q: q || undefined, status: status || undefined, from: from || undefined, to: to || undefined, page, size },
      })).data,
    placeholderData: keepPreviousData,
  })
  const rows = list.data?.content ?? []
  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0) }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Quotations</Typography>
        <Button variant="contained" onClick={() => navigate('/quotations/new')}>New quotation</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField autoFocus size="small" sx={{ minWidth: 280, flexGrow: 1 }}
          placeholder="Search quotation number or buyer name" value={search}
          onChange={(e) => reset(setSearch)(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        <TextField select size="small" label="Status" sx={{ minWidth: 130 }} value={status}
          onChange={(e) => reset(setStatus)(e.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="OPEN">Open</MenuItem>
          <MenuItem value="CANCELLED">Cancelled</MenuItem>
        </TextField>
        <TextField size="small" type="date" label="From" value={from}
          onChange={(e) => reset(setFrom)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="To" value={to}
          onChange={(e) => reset(setTo)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Paper>

      {list.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(list.error)}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Quotation</TableCell><TableCell>Date</TableCell><TableCell>Buyer</TableCell>
              <TableCell>Valid until</TableCell><TableCell align="right">Total</TableCell><TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const expired = r.status === 'OPEN' && r.validUntil < today
              return (
                <TableRow key={r.id} hover sx={{ cursor: 'pointer', opacity: r.status === 'CANCELLED' ? 0.5 : 1 }}
                  onClick={() => setParams({ open: String(r.id) })}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {r.quotationNo}{r.revision > 1 ? ` (Rev ${r.revision})` : ''}
                  </TableCell>
                  <TableCell>{fmtDate(r.quotationDate)}</TableCell>
                  <TableCell>{r.buyerName}</TableCell>
                  <TableCell sx={{ color: expired ? 'warning.dark' : undefined }}>{fmtDate(r.validUntil)}</TableCell>
                  <TableCell align="right">{inr(r.grandTotal)}</TableCell>
                  <TableCell>
                    {expired
                      ? <Chip size="small" color="warning" variant="outlined" label="EXPIRED" />
                      : <Chip size="small" variant="outlined" label={r.status} color={r.status === 'OPEN' ? 'success' : 'error'} />}
                  </TableCell>
                </TableRow>
              )
            })}
            {!list.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No quotations found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={list.data?.totalElements ?? 0}
          page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={size} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}
          rowsPerPageOptions={[20, 50, 100]} />
      </TableContainer>

      {openId !== null && <QuotationDialog key={openId} id={openId} onClose={() => setParams({})} />}
    </>
  )
}