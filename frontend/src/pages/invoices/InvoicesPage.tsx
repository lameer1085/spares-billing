import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  Alert, Box, Chip, InputAdornment, MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { api, errorMessage } from '../../api/client'
import { inr, type InvoiceSummary, type PageResponse } from '../../api/types'
import { useDebounce } from '../../hooks/useDebounce'
import { fmtDate } from '../../utils/format'
import InvoiceDialog from './InvoiceDialog'

export default function InvoicesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [openId, setOpenId] = useState<number | null>(null)
  const q = useDebounce(search.trim())

  const invoices = useQuery({
    queryKey: ['invoices', q, status, from, to, page, size],
    queryFn: async () =>
      (await api.get<PageResponse<InvoiceSummary>>('/invoices', {
        params: { q: q || undefined, status: status || undefined, from: from || undefined, to: to || undefined, page, size },
      })).data,
    placeholderData: keepPreviousData,
  })

  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0) }
  const rows = invoices.data?.content ?? []

  return (
    <>
      <Typography variant="h5" sx={{ mb: 2 }}>Invoices</Typography>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField autoFocus size="small" sx={{ minWidth: 280, flexGrow: 1 }}
          placeholder="Search invoice number or customer"
          value={search} onChange={(e) => reset(setSearch)(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        <TextField select size="small" label="Status" sx={{ minWidth: 130 }} value={status}
          onChange={(e) => reset(setStatus)(e.target.value)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="CANCELLED">Cancelled</MenuItem>
        </TextField>
        <TextField size="small" type="date" label="From" value={from}
          onChange={(e) => reset(setFrom)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="To" value={to}
          onChange={(e) => reset(setTo)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Paper>

      {invoices.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(invoices.error)}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Invoice</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell align="right">Due</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover sx={{ cursor: 'pointer', opacity: r.status === 'CANCELLED' ? 0.55 : 1 }}
                onClick={() => setOpenId(r.id)}>
                <TableCell sx={{ fontWeight: 600 }}>{r.invoiceNo}</TableCell>
                <TableCell>{fmtDate(r.invoiceDate)}</TableCell>
                <TableCell>{r.customerName}</TableCell>
                <TableCell align="right">{inr(r.grandTotal)}</TableCell>
                <TableCell align="right">{inr(r.paidAmount)}</TableCell>
                <TableCell align="right" sx={{ color: r.dueAmount > 0 ? 'warning.dark' : undefined, fontWeight: r.dueAmount > 0 ? 600 : 400 }}>
                  {r.dueAmount > 0 ? inr(r.dueAmount) : '—'}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={r.status} color={r.status === 'ACTIVE' ? 'success' : 'error'} variant="outlined" />
                </TableCell>
              </TableRow>
            ))}
            {!invoices.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No invoices found
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={invoices.data?.totalElements ?? 0}
          page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={size} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}
          rowsPerPageOptions={[20, 50, 100]} />
      </TableContainer>

      {openId !== null && <InvoiceDialog key={openId} id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}