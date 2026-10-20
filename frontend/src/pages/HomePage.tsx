import { useQuery } from '@tanstack/react-query'
import { Alert, CircularProgress, Typography } from '@mui/material'
import { api, errorMessage } from '../api/client'

export default function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['shop'],
    queryFn: async () => (await api.get('/shop')).data,
  })

  if (isLoading) return <CircularProgress />
  if (error) return <Alert severity="error">{errorMessage(error)}</Alert>

  return (
    <>
      <Typography variant="h5">Welcome</Typography>
      <Typography color="text.secondary">
        Shop: {data?.shopName ?? data?.name ?? JSON.stringify(data)}
      </Typography>
    </>
  )
}