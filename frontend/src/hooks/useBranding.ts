import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Branding } from '../api/types'

export function useBranding() {
  return useQuery({
    queryKey: ['branding'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await api.get<Branding>('/branding')).data,
  })
}

export const faviconUrl = (b: Branding) => `/api/branding/favicon?v=${b.version}`