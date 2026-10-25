import { Paper, Typography } from '@mui/material'
import ChangePasswordForm from './ChangePasswordForm'

export default function AccountPage() {
  return (
    <Paper sx={{ p: 3, maxWidth: 460 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>My account</Typography>
      <ChangePasswordForm />
    </Paper>
  )
}