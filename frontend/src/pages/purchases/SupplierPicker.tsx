import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Autocomplete, Box, TextField, Typography } from '@mui/material'
import { api } from '../../api/client'
import type { PageResponse, Supplier } from '../../api/types'
import { useDebounce } from '../../hooks/useDebounce'

interface Props {
  value: Supplier | null
  onChange: (s: Supplier | null) => void
  label?: string
  error?: string
}

export default function SupplierPicker({ value, onChange, label = 'Supplier', error }: Props) {
  const [input, setInput] = useState('')
  const q = useDebounce(input.trim(), 250)
  const { data, isFetching } = useQuery({
    queryKey: ['supplier-pick', q],
    queryFn: async () =>
      (await api.get<PageResponse<Supplier>>('/suppliers', { params: { q: q || undefined, size: 10 } })).data.content,
  })
  return (
    <Autocomplete
      options={data ?? []} value={value} onChange={(_, v) => onChange(v)}
      inputValue={input} onInputChange={(_, v) => setInput(v)}
      getOptionLabel={(s) => s.name} isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(x) => x} loading={isFetching} noOptionsText="No supplier found"
      renderOption={(props, s) => {
        const { key, ...rest } = props as typeof props & { key: string }
        return (
          <li key={key} {...rest}>
            <Box>
              <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {[s.phone, s.gstin, s.stateName].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </li>
        )
      }}
      renderInput={(params) => <TextField {...params} label={label} error={!!error} helperText={error} />}
    />
  )
}