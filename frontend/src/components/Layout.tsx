import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import { AppBar, Box, Button, Chip, Toolbar, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthContext'

const links = [
  { to: '/', label: 'Home', ownerOnly: false },
  { to: '/products', label: 'Products', ownerOnly: false },
  { to: '/customers', label: 'Customers', ownerOnly: false },
]

export default function Layout() {
  const { user, logout, isOwner } = useAuth()
  const { pathname } = useLocation()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ mr: 2 }}>Spares Billing</Typography>
          {links.filter((l) => !l.ownerOnly || isOwner).map((l) => (
            <Button key={l.to} component={RouterLink} to={l.to} color="inherit"
              sx={{ opacity: pathname === l.to ? 1 : 0.75 }}>
              {l.label}
            </Button>
          ))}
          <Box sx={{ flexGrow: 1 }} />
          <Chip size="small" label={`${user?.username} · ${user?.role}`}
            sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,.5)' }} variant="outlined" />
          <Button color="inherit" onClick={logout}>Logout</Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  )
}