import { useState, type Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Autocomplete, Box, Chip, InputAdornment, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { api } from '../../api/client'
import { inr, type PageResponse, type Product } from '../../api/types'
import { useDebounce } from '../../hooks/useDebounce'

interface Props {
  onPick: (p: Product) => void
  inputRef: Ref<HTMLInputElement>
}

export default function ProductSearch({ onPick, inputRef }: Props) {
  const [input, setInput] = useState('')
  const q = useDebounce(input.trim(), 250)

  const { data, isFetching } = useQuery({
    queryKey: ['product-pick', q],
    enabled: q.length > 0,
    queryFn: async () =>
      (await api.get<PageResponse<Product>>('/products', { params: { q, size: 10 } })).data.content,
  })

  // While the next results are loading, show nothing, so Enter can never pick a stale row
  const options = q.length > 0 && !isFetching && q === input.trim() ? (data ?? []) : []

  return (
    <Autocomplete<Product>
      options={options}
      value={null}
      autoHighlight
      openOnFocus={false}
      inputValue={input}
      onInputChange={(_, v, reason) => setInput(reason === 'reset' ? '' : v)}
      onChange={(_, p) => { if (p) onPick(p) }}
      getOptionLabel={(p) => p.partNumber}
      filterOptions={(x) => x}
      loading={isFetching}
      noOptionsText={q ? (isFetching ? 'Searching…' : 'No part found') : 'Type part number, name, vehicle or brand'}
      renderOption={(props, p) => {
        const { key, ...rest } = props as typeof props & { key: string }
        return (
          <li key={key} {...rest}>
            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{p.partNumber} · {p.name}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {[p.brandName, p.vehicleCompatibility, p.rackLocation && `Rack ${p.rackLocation}`]
                    .filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Typography sx={{ whiteSpace: 'nowrap' }}>{inr(p.sellingPrice)}</Typography>
              <Chip size="small" label={`Stock ${p.stockQty}`}
                color={p.stockQty <= 0 ? 'error' : p.lowStock ? 'warning' : 'default'} />
            </Box>
          </li>
        )
      }}
      renderInput={(params) => (
  <TextField
    {...params}
    inputRef={inputRef}
    autoFocus
    placeholder="Search part number, name, vehicle or brand, then press Enter  (F2 to come back here)"
  />
)}
    />
  )
}