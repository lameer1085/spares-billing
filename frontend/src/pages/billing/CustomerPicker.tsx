import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material'
import { api } from '../../api/client'
import { inr, type BalanceResponse, type Customer, type PageResponse } from '../../api/types'
import { useDebounce } from '../../hooks/useDebounce'

interface Props {
  value: Customer | null
  onChange: (c: Customer | null) => void
}

export default function CustomerPicker({ value, onChange }: Props) {
  const [input, setInput] = useState('')
  const q = useDebounce(input.trim(), 250)

  const { data, isFetching } = useQuery({
    queryKey: ['customer-pick', q],
    queryFn: async () =>
      (await api.get<PageResponse<Customer>>('/customers', { params: { q: q || undefined, size: 10 } })).data.content,
  })

  const balance = useQuery({
    queryKey: ['balance', value?.id],
    enabled: !!value,
    queryFn: async () => (await api.get<BalanceResponse>(`/customers/${value!.id}/balance`)).data,
  })

  return (
    <Box>
      <Autocomplete
        options={data ?? []}
        value={value}
        onChange={(_, v) => onChange(v)}
        inputValue={input}
        onInputChange={(_, v) => setInput(v)}
        getOptionLabel={(c) => c.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(x) => x}
        loading={isFetching}
        noOptionsText="No customer found"
        renderOption={(props, c) => {
          const { key, ...rest } = props as typeof props & { key: string }
          return (
            <li key={key} {...rest}>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[c.phone, c.gstin, c.stateName].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
            </li>
          )
        }}
        renderInput={(params) => (
  <TextField {...params} label="Customer (leave empty for walk-in)" />
)}
      />
      {value && balance.data && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Chip size="small" color={balance.data.balance > 0 ? 'warning' : 'default'}
            label={balance.data.balance >= 0
              ? `Owes ${inr(balance.data.balance)}`
              : `Advance ${inr(-balance.data.balance)}`} />
          <Chip size="small" variant="outlined" label={`Credit limit ${inr(balance.data.creditLimit)}`} />
          <Chip size="small" variant="outlined" label={`Available ${inr(balance.data.availableCredit)}`} />
        </Box>
      )}
    </Box>
  )
}