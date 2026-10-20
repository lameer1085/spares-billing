import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStore, setUnauthorizedHandler } from '../api/client'

export interface User {
  username: string
  role: 'OWNER' | 'STAFF'
}

interface AuthState {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isOwner: boolean
}

const USER_KEY = 'spares_user'
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw && tokenStore.get() ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })

  const logout = () => {
    tokenStore.clear()
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [])

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password })
    const u: User = { username: data.username, role: data.role } // <-- check names
    tokenStore.set(data.token)                                    // <-- check name
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isOwner: user?.role === 'OWNER' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}