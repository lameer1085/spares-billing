import { Paper, Typography } from '@mui/material'

interface Props {
  label: string
  value: string
  hint?: string
  color?: string
  onClick?: () => void
}

export default function StatCard({ label, value, hint, color, onClick }: Props) {
  return (
    <Paper onClick={onClick}
      sx={{ p: 2, cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { boxShadow: 4 } : undefined }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color }}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
  )
}