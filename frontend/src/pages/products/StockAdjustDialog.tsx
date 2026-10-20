import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { api, errorMessage } from '../../api/client'
import type { Product } from '../../api/types'

export default function StockAdjustDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient()
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const save = useMutation({
    mutationFn: () =>
      api.post(`/products/${product.id}/stock-adjustments`, {
        quantityChange: Number(qty),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      onClose()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const n = Number(qty)
  const valid = qty !== '' && Number.isInteger(n) && n !== 0 && reason.trim() !== ''

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adjust stock: {product.partNumber}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Current stock: {product.stockQty}. Use a plus number to add and a minus number to remove.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Quantity change (e.g. -2 or 5)" type="number" fullWidth autoFocus margin="dense"
          value={qty} onChange={(e) => setQty(e.target.value)} />
        <TextField label="Reason (e.g. Damaged, Count correction)" fullWidth margin="dense"
          value={reason} onChange={(e) => setReason(e.target.value)} />
        {valid && (
          <Typography variant="body2" sx={{ mt: 1 }}>New stock will be {product.stockQty + n}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          Adjust
        </Button>
      </DialogActions>
    </Dialog>
  )
}