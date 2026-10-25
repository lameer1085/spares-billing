import { useState } from 'react'
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar, Avatar, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, ListItemText,
  ListSubheader, Menu, MenuItem, Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import AddIcon from '@mui/icons-material/Add'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { useAuth } from '../auth/AuthContext'
import { faviconUrl, useBranding } from '../hooks/useBranding'
import PasswordGate from './PasswordGate'

interface Leaf { label: string; to: string; ownerOnly?: boolean }
interface Group { label: string; items: Leaf[]; ownerOnly?: boolean }
type Entry = Leaf | Group
const isGroup = (e: Entry): e is Group => 'items' in e

const NAV: Entry[] = [
  { label: 'Home', to: '/' },
  {
    label: 'Sales',
    items: [
      { label: 'New bill', to: '/billing' },
      { label: 'Invoices', to: '/invoices' },
      { label: 'Quotations', to: '/quotations' },
      { label: 'Returns (credit notes)', to: '/credit-notes' },
      { label: 'Payments', to: '/payments' },
    ],
  },
  {
    label: 'Stock',
    items: [
      { label: 'Products', to: '/products' },
      { label: 'Purchases', to: '/purchases', ownerOnly: true },
      { label: 'Suppliers', to: '/suppliers', ownerOnly: true },
    ],
  },
  { label: 'Customers', to: '/customers' },
  { label: 'Reports', to: '/reports', ownerOnly: true },
]

const matches = (pathname: string, to: string) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/')

const navSx = (active: boolean): SxProps<Theme> => ({
  height: 64,
  px: 1.75,
  borderRadius: 0,
  textTransform: 'none',
  fontSize: 15,
  fontWeight: active ? 700 : 500,
  color: active ? 'primary.main' : 'text.primary',
  borderBottom: '3px solid',
  borderColor: active ? 'primary.main' : 'transparent',
  '&:hover': { bgcolor: 'action.hover' },
})

function NavGroup({ group, pathname }: { group: Group; pathname: string }) {
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const items = group.items.filter((i) => !i.ownerOnly || isOwner)
  if (items.length === 0) return null
  const active = items.some((i) => matches(pathname, i.to))
  return (
    <>
      <Button color="inherit" sx={navSx(active)} endIcon={<KeyboardArrowDownIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}>
        {group.label}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 0.5 } } }}>
        {items.map((i) => (
          <MenuItem key={i.to} selected={matches(pathname, i.to)}
            onClick={() => { setAnchor(null); navigate(i.to) }}>
            {i.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default function Layout() {
  const { user, logout, isOwner } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))
  const { data: branding } = useBranding()
  const [drawer, setDrawer] = useState(false)
  const [userAnchor, setUserAnchor] = useState<HTMLElement | null>(null)

  const appName = branding?.appName ?? 'Billing'
  const visible = NAV.filter((e) => !e.ownerOnly || isOwner)
  const initial = (user?.username ?? '?').charAt(0).toUpperCase()
  const go = (to: string) => { setDrawer(false); setUserAnchor(null); navigate(to) }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="sticky" color="inherit" elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar sx={{ gap: 1, minHeight: 64 }}>
          {mobile && (
            <IconButton edge="start" onClick={() => setDrawer(true)} aria-label="Open menu"><MenuIcon /></IconButton>
          )}
          <Box onClick={() => go('/')} sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mr: 2 }}>
            {branding?.hasFavicon && (
              <Box component="img" src={faviconUrl(branding)} alt="" sx={{ width: 28, height: 28, borderRadius: 1 }} />
            )}
            <Typography variant="h6" noWrap sx={{ fontWeight: 800, color: 'primary.main', maxWidth: { xs: 160, md: 260 } }}>
              {appName}
            </Typography>
          </Box>

          {!mobile && visible.map((e) =>
            isGroup(e) ? (
              <NavGroup key={e.label} group={e} pathname={pathname} />
            ) : (
              <Button key={e.to} color="inherit" component={RouterLink} to={e.to} sx={navSx(matches(pathname, e.to))}>
                {e.label}
              </Button>
            ),
          )}

          <Box sx={{ flexGrow: 1 }} />

          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => go('/billing')}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            New bill
          </Button>

          <IconButton onClick={(e) => setUserAnchor(e.currentTarget)} sx={{ ml: 0.5 }} aria-label="Account menu">
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 15 }}>{initial}</Avatar>
          </IconButton>
          <Menu anchorEl={userAnchor} open={!!userAnchor} onClose={() => setUserAnchor(null)}
            slotProps={{ paper: { sx: { minWidth: 220, mt: 0.5 } } }}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{user?.username}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.role}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => go('/account')}>My account</MenuItem>
            {isOwner && <MenuItem onClick={() => go('/settings')}>Shop settings</MenuItem>}
            {isOwner && <MenuItem onClick={() => go('/users')}>Users</MenuItem>}
            <Divider />
            <MenuItem onClick={() => { setUserAnchor(null); logout() }}>Log out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer open={drawer} onClose={() => setDrawer(false)}>
        <Box sx={{ width: 270 }} role="navigation">
          <Typography variant="h6" sx={{ p: 2, fontWeight: 800, color: 'primary.main' }}>{appName}</Typography>
          <Divider />
          <List dense>
            {visible.map((e) =>
              isGroup(e) ? (
                <Box key={e.label}>
                  <ListSubheader sx={{ lineHeight: '32px', mt: 1 }}>{e.label.toUpperCase()}</ListSubheader>
                  {e.items.filter((i) => !i.ownerOnly || isOwner).map((i) => (
                    <ListItemButton key={i.to} selected={matches(pathname, i.to)} onClick={() => go(i.to)}>
                      <ListItemText primary={i.label} />
                    </ListItemButton>
                  ))}
                </Box>
              ) : (
                <ListItemButton key={e.to} selected={matches(pathname, e.to)} onClick={() => go(e.to)}>
                  <ListItemText primary={e.label} />
                </ListItemButton>
              ),
            )}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, mx: 'auto' }}>
        <Outlet />
      </Box>
      <PasswordGate />
    </Box>
  )
}