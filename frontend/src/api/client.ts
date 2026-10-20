import axios from 'axios'

const TOKEN_KEY = 'spares_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Turn any error into one readable message
export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status
    if (!e.response) return 'Cannot reach the server. Is the backend running?'
    if (status === 401) return 'Session expired or wrong credentials.'
    if (status === 403) return 'You do not have permission to do this.'
    if (status === 503) return 'Server cannot reach the database. Tell the owner.'
    const data = e.response.data as { message?: string } | undefined
    return data?.message ?? `Request failed (${status})`
  }
  return 'Something went wrong.'
}

// Registered by AuthContext: on 401 from a protected call, log the user out
let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const isLogin = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !isLogin) onUnauthorized()
    return Promise.reject(error)
  },
)