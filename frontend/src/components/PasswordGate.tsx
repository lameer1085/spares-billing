import { useQuery } from '@tanstack/react-query'
import { Alert, Dialog, DialogContent, DialogTitle } from '@mui/material'
import { api } from '../api/client'
import type { AppUser } from '../api/types'
import ChangePasswordForm from '../pages/account/ChangePasswordForm'

export default function PasswordGate() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<AppUser>('/auth/me')).data,
  })
  if (!me.data?.mustChangePassword) return null
  return (
    <Dialog open maxWidth="xs" fullWidth>
      <DialogTitle>Choose your own password</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your password was set by someone else. Choose a new one before you continue.
        </Alert>
        <ChangePasswordForm />
      </DialogContent>
    </Dialog>
  )
}