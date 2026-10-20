import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute({ ownerOnly = false }: { ownerOnly?: boolean }) {
  const { user, isOwner } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (ownerOnly && !isOwner) return <Navigate to="/" replace />
  return <Outlet />
}