import { useEffect, useState } from 'react'

export function usePersistentState<T>(
  key: string,
  initial: T,
  persist = true,
): [T, (v: T | ((p: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (!persist) return initial
    try {
      const raw = localStorage.getItem(key)
      return raw ? ({ ...initial, ...JSON.parse(raw) } as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    if (!persist) return
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* memory only */ }
  }, [key, value, persist])
  const clear = () => {
    if (persist) {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
    }
    setValue(initial)
  }
  return [value, setValue, clear]
}