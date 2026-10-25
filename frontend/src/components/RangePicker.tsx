import { Box, Chip, TextField } from '@mui/material'
import { presets, todayIST } from '../utils/dates'

interface Props {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

export default function RangePicker({ from, to, onChange }: Props) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
      {presets().map((p) => (
        <Chip key={p.label} label={p.label} clickable onClick={() => onChange(p.from, p.to)}
          color={p.from === from && p.to === to ? 'primary' : 'default'}
          variant={p.from === from && p.to === to ? 'filled' : 'outlined'} />
      ))}
      <TextField size="small" type="date" label="From" value={from}
        onChange={(e) => onChange(e.target.value, to)}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIST() } }} />
      <TextField size="small" type="date" label="To" value={to}
        onChange={(e) => onChange(from, e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }} />
    </Box>
  )
}