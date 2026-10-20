import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import type { NameItem, Product } from '../../api/types'

interface Props {
  product: Product | null // null = create
  brands: NameItem[]
  categories: NameItem[]
  onClose: () => void
}

export default function ProductFormDialog({ product, brands, categories, onClose }: Props) {
  const qc = useQueryClient()
  const isEdit = product !== null
  const [f, setF] = useState({
    partNumber: product?.partNumber ?? '',
    name: product?.name ?? '',
    brandId: product?.brandId?.toString() ?? '',
    categoryId: product?.categoryId?.toString() ?? '',
    vehicleCompatibility: product?.vehicleCompatibility ?? '',
    hsnCode: product?.hsnCode ?? '',
    gstRate: product?.gstRate?.toString() ?? '18',
    mrp: product?.mrp?.toString() ?? '',
    purchasePrice: product?.purchasePrice?.toString() ?? '',
    sellingPrice: product?.sellingPrice?.toString() ?? '',
    minStock: product?.minStock?.toString() ?? '0',
    rackLocation: product?.rackLocation ?? '',
    openingStock: '0',
  })
  const [error, setError] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        partNumber: f.partNumber.trim(),
        name: f.name.trim(),
        brandId: f.brandId ? Number(f.brandId) : null,
        categoryId: f.categoryId ? Number(f.categoryId) : null,
        vehicleCompatibility: f.vehicleCompatibility.trim() || null,
        hsnCode: f.hsnCode.trim() || null,
        gstRate: Number(f.gstRate),
        mrp: Number(f.mrp),
        purchasePrice: Number(f.purchasePrice),
        sellingPrice: Number(f.sellingPrice),
        minStock: Number(f.minStock) || 0,
        rackLocation: f.rackLocation.trim() || null,
        openingStock: isEdit ? null : Number(f.openingStock) || 0,
      }
      return isEdit
        ? api.put(`/products/${product!.id}`, body)
        : api.post('/products', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      onClose()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const submit = () => {
    setError('')
    if (!f.partNumber.trim() || !f.name.trim()) return setError('Part number and name are required.')
    if (f.mrp === '' || f.purchasePrice === '' || f.sellingPrice === '')
      return setError('MRP, purchase price and selling price are required.')
    if (Number(f.sellingPrice) > Number(f.mrp)) return setError('Selling price cannot be higher than MRP.')
    save.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? `Edit ${product!.partNumber}` : 'Add product'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
          <TextField label="Part number" value={f.partNumber} onChange={set('partNumber')} autoFocus required />
          <TextField label="Name" value={f.name} onChange={set('name')} required />
          <TextField select label="Brand" value={f.brandId} onChange={set('brandId')}>
            <MenuItem value="">None</MenuItem>
            {brands.map((b) => <MenuItem key={b.id} value={b.id.toString()}>{b.name}</MenuItem>)}
          </TextField>
          <TextField select label="Category" value={f.categoryId} onChange={set('categoryId')}>
            <MenuItem value="">None</MenuItem>
            {categories.map((c) => <MenuItem key={c.id} value={c.id.toString()}>{c.name}</MenuItem>)}
          </TextField>
          <TextField label="Vehicle compatibility" value={f.vehicleCompatibility}
            onChange={set('vehicleCompatibility')} sx={{ gridColumn: { sm: '1 / -1' } }}
            helperText="e.g. Maruti Swift 2012-2018, Dzire 2012-2017" />
          <TextField label="HSN code" value={f.hsnCode} onChange={set('hsnCode')} />
          <TextField label="GST %" type="number" value={f.gstRate} onChange={set('gstRate')} required />
          <TextField label="MRP" type="number" value={f.mrp} onChange={set('mrp')} required />
          <TextField label="Purchase price" type="number" value={f.purchasePrice} onChange={set('purchasePrice')} required />
          <TextField label="Selling price (GST inclusive)" type="number" value={f.sellingPrice}
            onChange={set('sellingPrice')} required />
          <TextField label="Minimum stock (alert level)" type="number" value={f.minStock} onChange={set('minStock')} />
          <TextField label="Rack location" value={f.rackLocation} onChange={set('rackLocation')} />
          {!isEdit && (
            <TextField label="Opening stock" type="number" value={f.openingStock}
              onChange={set('openingStock')} helperText="Quantity already on the shelf today" />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}