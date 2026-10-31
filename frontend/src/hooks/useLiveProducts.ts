import { useEffect } from 'react'
import { useQueries } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Product } from '../api/types'

// Keeps the parts inside an open bill, purchase or quotation in step with the Products page.
// The latest copy of every part in `ids` is fetched when the page opens and whenever you come back
// to this browser tab. Each time fresh copies arrive, onFresh is called with all of them. The caller
// compares them with what its lines hold and updates only the lines that really changed.
export function useLiveProducts(ids: number[], onFresh: (fresh: Product[]) => void) {
  const unique = [...new Set(ids)].sort((a, b) => a - b)
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: ['product-live', id],
      queryFn: async () => (await api.get<Product>(`/products/${id}`)).data,
      staleTime: 0,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: true,
    })),
  })

  // changes whenever any part has been (re)fetched
  const stamp = results.map((r) => r.dataUpdatedAt).join(',')
  useEffect(() => {
    const fresh = results.map((r) => r.data).filter((p): p is Product => !!p)
    if (fresh.length > 0) onFresh(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp])
}
