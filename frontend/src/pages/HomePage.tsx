import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import { api, errorMessage } from '../api/client'
import { inr, type Dashboard } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import StatCard from '../components/StatCard'
import { fmtDate } from '../utils/format'

export default function HomePage() {
  const { isOwner, user } = useAuth()
  const navigate = useNavigate()

  const shop = useQuery({
    queryKey: ['shop'],
    queryFn: async () => (await api.get('/shop')).data as { shopName?: string },
  })
  const dash = useQuery({
    queryKey: ['dashboard'],
    enabled: isOwner,
    refetchInterval: 60_000, // refresh every minute
    queryFn: async () => (await api.get<Dashboard>('/reports/dashboard')).data,
  })

  const d = dash.data

  return (
    <>
      <Typography variant="h5">{shop.data?.shopName ?? 'Spares Billing'}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Welcome, {user?.username}{d ? ` · ${fmtDate(d.date)}` : ''}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Button variant="contained" size="large" onClick={() => navigate('/billing')}>New bill</Button>
        <Button variant="outlined" size="large" onClick={() => navigate('/payments')}>Receive payment</Button>
        <Button variant="outlined" size="large" onClick={() => navigate('/products')}>Find a part</Button>
        {isOwner && <Button variant="outlined" size="large" onClick={() => navigate('/purchases/new')}>New purchase</Button>}
      </Box>

      {isOwner && dash.isLoading && <CircularProgress />}
      {isOwner && dash.error && <Alert severity="error">{errorMessage(dash.error)}</Alert>}
      {d && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' } }}>
          <StatCard label="Today's sales (after returns)" value={inr(d.salesTotal)} hint={`${d.invoiceCount} bill(s)`}
            onClick={() => navigate('/invoices')} />
          <StatCard label="Money collected today" value={inr(d.collectedToday)} hint="Cash, UPI, card and bank, after refunds"
            onClick={() => navigate('/payments')} />
          <StatCard label="Customers owe you" value={inr(d.customerDues)}
            color={d.customerDues > 0 ? 'warning.dark' : undefined} onClick={() => navigate('/customers')} />
          <StatCard label="You owe suppliers" value={inr(d.supplierDues)}
            color={d.supplierDues > 0 ? 'warning.dark' : undefined} onClick={() => navigate('/purchases')} />
          <StatCard label="Low-stock parts" value={String(d.lowStockCount)}
            color={d.lowStockCount > 0 ? 'error.main' : undefined} hint="At or below minimum stock"
            onClick={() => navigate('/products')} />
        </Box>
      )}
    </>
  )
}