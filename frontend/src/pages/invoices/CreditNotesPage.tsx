import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  Alert, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Typography, Box,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { api, errorMessage } from '../../api/client'
import { inr, type CreditNoteSummary, type PageResponse } from '../../api/types'
import { useDebounce } from '../../hooks/useDebounce'
import { fmtDate } from '../../utils/format'
import CreditNoteDialog from './CreditNoteDialog'

export default function CreditNotesPage() {
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [openId, setOpenId] = useState<number | null>(null)
  const q = useDebounce(search.trim())

  const list = useQuery({
    queryKey: ['credit-notes', q, from, to, page, size],
    queryFn: async () =>
      (await api.get<PageResponse<CreditNoteSummary>>('/credit-notes', {
        params: { q: q || undefined, from: from || undefined, to: to || undefined, page, size },
      })).data,
    placeholderData: keepPreviousData,
  })
  const rows = list.data?.content ?? []

  return (
    <>
      <Typography variant="h5" sx={{ mb: 2 }}>Credit notes (returns)</Typography>
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField autoFocus size="small" sx={{ minWidth: 280, flexGrow: 1 }}
          placeholder="Search credit note number, invoice number or customer"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        <TextField size="small" type="date" label="From" value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(0) }} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="To" value={to}
          onChange={(e) => { setTo(e.target.value); setPage(0) }} slotProps={{ inputLabel: { shrink: true } }} />
      </Paper>

      {list.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(list.error)}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Credit note</TableCell><TableCell>Date</TableCell><TableCell>Against invoice</TableCell>
              <TableCell>Customer</TableCell><TableCell align="right">Total</TableCell>
              <TableCell align="right">Refunded</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenId(r.id)}>
                <TableCell sx={{ fontWeight: 600 }}>{r.creditNoteNo}</TableCell>
                <TableCell>{fmtDate(r.creditNoteDate)}</TableCell>
                <TableCell>{r.invoiceNo}</TableCell>
                <TableCell>{r.customerName ?? 'Walk-in'}</TableCell>
                <TableCell align="right">{inr(r.grandTotal)}</TableCell>
                <TableCell align="right">{r.refundAmount > 0 ? inr(r.refundAmount) : '—'}</TableCell>
              </TableRow>
            ))}
            {!list.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No credit notes found
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={list.data?.totalElements ?? 0}
          page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={size} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}
          rowsPerPageOptions={[20, 50, 100]} />
      </TableContainer>
      {openId !== null && <Box><CreditNoteDialog id={openId} onClose={() => setOpenId(null)} /></Box>}
    </>
  )
}