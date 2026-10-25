import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type PageResponse, type PurchaseSummary, type Supplier, type SupplierDue } from '../../api/types'
import { fmtDate } from '../../utils/format'
import PurchaseDialog from './PurchaseDialog'
import SupplierPicker from './SupplierPicker'

export default function PurchasesPage() {
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [openId, setOpenId] = useState<number | null>(null)

  const list = useQuery({
    queryKey: ['purchases', supplier?.id, from, to, page, size],
    queryFn: async () =>
      (await api.get<PageResponse<PurchaseSummary>>('/purchases', {
        params: { supplierId: supplier?.id, from: from || undefined, to: to || undefined, page, size },
      })).data,
    placeholderData: keepPreviousData,
  })
  const dues = useQuery({
    queryKey: ['purchase-dues'],
    queryFn: async () => (await api.get<SupplierDue[]>('/purchases/dues')).data,
  })
  const totalDue = dues.data?.reduce((s, d) => s + d.due, 0) ?? 0
  const rows = list.data?.content ?? []

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Purchases</Typography>
        {totalDue > 0 && <Chip color="warning" label={`You owe suppliers: ${inr(totalDue)}`} />}
        <Button variant="contained" onClick={() => navigate('/purchases/new')}>New purchase</Button>
      </Box>

      {dues.data && dues.data.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {dues.data.map((d) => <Chip key={d.supplierId} variant="outlined" label={`${d.supplierName} ${inr(d.due)}`} />)}
        </Box>
      )}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 280, flexGrow: 1 }}>
          <SupplierPicker label="Filter by supplier" value={supplier} onChange={(s) => { setSupplier(s); setPage(0) }} />
        </Box>
        <TextField type="date" label="From" value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(0) }} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" label="To" value={to}
          onChange={(e) => { setTo(e.target.value); setPage(0) }} slotProps={{ inputLabel: { shrink: true } }} />
      </Paper>

      {list.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(list.error)}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell><TableCell>Supplier</TableCell><TableCell>Supplier invoice</TableCell>
              <TableCell align="right">Total</TableCell><TableCell align="right">Paid</TableCell>
              <TableCell align="right">Due</TableCell><TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover sx={{ cursor: 'pointer', opacity: r.status === 'CANCELLED' ? 0.5 : 1 }}
                onClick={() => setOpenId(r.id)}>
                <TableCell>{fmtDate(r.purchaseDate)}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{r.supplierName}</TableCell>
                <TableCell>{r.supplierInvoiceNo}</TableCell>
                <TableCell align="right">{inr(r.totalAmount)}</TableCell>
                <TableCell align="right">{inr(r.paidAmount)}</TableCell>
                <TableCell align="right" sx={{ color: r.dueAmount > 0 ? 'warning.dark' : undefined, fontWeight: r.dueAmount > 0 ? 600 : 400 }}>
                  {r.dueAmount > 0 ? inr(r.dueAmount) : '—'}
                </TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={r.status} color={r.status === 'ACTIVE' ? 'success' : 'error'} />
                </TableCell>
              </TableRow>
            ))}
            {!list.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No purchases found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={list.data?.totalElements ?? 0}
          page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={size} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}
          rowsPerPageOptions={[20, 50, 100]} />
      </TableContainer>

      {openId !== null && <PurchaseDialog key={openId} id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}