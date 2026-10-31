import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type NameItem, type Product } from '../../api/types'

interface Props {
  product: Product | null // null = create
  brands: NameItem[]
  categories: NameItem[]
  onClose: () => void
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const str = (n: number) => String(r2(n))

// Supplier discount shown for an existing part = how far the cost is below the list price
const discountOf = (p: Product | null) =>
  p && p.listPrice != null && p.listPrice > 0 && p.purchasePrice != null
    ? str((1 - p.purchasePrice / p.listPrice) * 100)
    : ''

const makeInitial = (p: Product | null) => ({
  partNumber: p?.partNumber ?? '',
  name: p?.name ?? '',
  brandId: p?.brandId?.toString() ?? '',
  categoryId: p?.categoryId?.toString() ?? '',
  vehicleCompatibility: p?.vehicleCompatibility ?? '',
  hsnCode: (p?.hsnCode ?? '').replace(/\D/g, ''),
  gstRate: p?.gstRate?.toString() ?? '18',
  listPrice: p?.listPrice?.toString() ?? '',
  discount: discountOf(p),
  mrp: p?.mrp?.toString() ?? '',
  purchasePrice: p?.purchasePrice?.toString() ?? '',
  sellingPrice: p?.sellingPrice?.toString() ?? '',
  minStock: p?.minStock?.toString() ?? '0',
  rackLocation: p?.rackLocation ?? '',
  openingStock: '0',
})
type Form = ReturnType<typeof makeInitial>
type Field = keyof Form
type Errors = Partial<Record<Field, string>>

const FIELDS = Object.keys(makeInitial(null)) as Field[]

// For server messages that do not name a field, guess the box from the words used.
// Order matters: more specific phrases first.
const KEYWORDS: [RegExp, Field][] = [
  [/list price/i, 'listPrice'],
  [/selling price/i, 'sellingPrice'],
  [/purchase price/i, 'purchasePrice'],
  [/part number/i, 'partNumber'],
  [/mrp/i, 'mrp'],
  [/brand/i, 'brandId'],
  [/category/i, 'categoryId'],
  [/hsn/i, 'hsnCode'],
  [/gst/i, 'gstRate'],
  [/opening stock/i, 'openingStock'],
  [/minimum stock|min stock/i, 'minStock'],
  [/rack/i, 'rackLocation'],
]

// Splits "partNumber: must not be blank; mrp: must be at least 0" into per-field messages.
function splitServerMessage(msg: string): { errors: Errors; general: string[] } {
  const errors: Errors = {}
  const general: string[] = []
  for (const raw of msg.split(';')) {
    const part = raw.trim()
    if (!part) continue
    const m = /^(\w+):\s*(.*)$/.exec(part)
    if (m && (FIELDS as string[]).includes(m[1])) {
      errors[m[1] as Field] = m[2]
      continue
    }
    const hit = KEYWORDS.find(([re]) => re.test(part))
    if (hit) errors[hit[1]] = part
    else general.push(part)
  }
  return { errors, general }
}

function validate(f: Form, isEdit: boolean): Errors {
  const e: Errors = {}
  if (!f.partNumber.trim()) e.partNumber = 'Part number is required'
  if (!f.name.trim()) e.name = 'Name is required'

  const money = (k: 'mrp' | 'purchasePrice' | 'sellingPrice', label: string) => {
    if (f[k] === '') e[k] = `${label} is required`
    else if (isNaN(Number(f[k])) || Number(f[k]) < 0) e[k] = `${label} must be 0 or more`
  }
  money('mrp', 'MRP')
  money('purchasePrice', 'Purchase price')
  money('sellingPrice', 'Selling price')

  if (!e.mrp && !e.sellingPrice && Number(f.sellingPrice) > Number(f.mrp))
    e.sellingPrice = 'Selling price cannot be higher than MRP'

  if (f.listPrice !== '' && (isNaN(Number(f.listPrice)) || Number(f.listPrice) <= 0))
    e.listPrice = 'List price must be more than 0'
  if (f.discount !== '' && (isNaN(Number(f.discount)) || Number(f.discount) < 0 || Number(f.discount) > 100))
    e.discount = 'Discount must be 0 to 100. Is the purchase price higher than the list price?'

  if (f.hsnCode !== '' && !/^\d{4,8}$/.test(f.hsnCode)) e.hsnCode = 'HSN must be 4 to 8 digits, numbers only'

  if (f.gstRate === '' || isNaN(Number(f.gstRate)) || Number(f.gstRate) < 0 || Number(f.gstRate) > 40)
    e.gstRate = 'GST must be between 0 and 40'

  if (f.minStock !== '' && (!Number.isInteger(Number(f.minStock)) || Number(f.minStock) < 0))
    e.minStock = 'Enter a whole number, 0 or more'
  if (!isEdit && f.openingStock !== '' && (!Number.isInteger(Number(f.openingStock)) || Number(f.openingStock) < 0))
    e.openingStock = 'Enter a whole number, 0 or more'
  return e
}

export default function ProductFormDialog({ product, brands, categories, onClose }: Props) {
  const qc = useQueryClient()
  const isEdit = product !== null
  const [f, setF] = useState<Form>(() => makeInitial(product))
  const [errors, setErrors] = useState<Errors>({})
  const [general, setGeneral] = useState<string[]>([])
  // Once you type an MRP yourself (or the part already has one), it is no longer filled in for you
  const [mrpTouched, setMrpTouched] = useState<boolean>(isEdit && !!product?.mrp)

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    if (k === 'hsnCode') value = value.replace(/\D/g, '').slice(0, 8) // "8421.23.00" becomes 84212300

    const next: Form = { ...f, [k]: value }

    // list price x (1 - discount) = purchase price, list price x (1 + GST) = selling price
    const list = Number(next.listPrice)
    if (next.listPrice !== '' && list > 0) {
      if (k === 'listPrice' || k === 'discount')
        next.purchasePrice = str(list * (1 - (Number(next.discount) || 0) / 100))
      if (k === 'listPrice' || k === 'gstRate')
        next.sellingPrice = str(list * (1 + (Number(next.gstRate) || 0) / 100))
    }
    // typing the purchase price yourself moves the discount instead (the list price stays)
    if (k === 'purchasePrice' && next.listPrice !== '' && list > 0 && value !== '' && !isNaN(Number(value)))
      next.discount = str((1 - Number(value) / list) * 100)

    if (k === 'mrp') setMrpTouched(true)
    else if (!mrpTouched && (k === 'listPrice' || k === 'gstRate' || k === 'sellingPrice'))
      next.mrp = next.sellingPrice // until you type your own MRP, it follows the selling price

    setF(next)
    setErrors({
      ...errors, [k]: undefined,
      ...(k === 'listPrice' || k === 'discount' ? { purchasePrice: undefined } : {}),
      ...(k === 'purchasePrice' ? { discount: undefined } : {}),
    })
  }

  // Props shared by every box: value, change handler, red border and message underneath
  const field = (k: Field, hint?: string) => ({
    value: f[k],
    onChange: set(k),
    error: !!errors[k],
    helperText: errors[k] ?? hint,
  })

  // Same, for dropdowns: shows "None" instead of a blank box
  const dropdown = (k: Field) => ({
    ...field(k),
    select: true as const,
    slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } },
  })

  const sellingBeforeGst =
    f.sellingPrice !== '' && !isNaN(Number(f.sellingPrice))
      ? `Price before GST: ${inr(r2((Number(f.sellingPrice) * 100) / (100 + (Number(f.gstRate) || 0))))}`
      : 'GST included. Billing takes the GST out of this price'

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        partNumber: f.partNumber.trim(),
        name: f.name.trim(),
        brandId: f.brandId ? Number(f.brandId) : null,
        categoryId: f.categoryId ? Number(f.categoryId) : null,
        vehicleCompatibility: f.vehicleCompatibility.trim() || null,
        hsnCode: f.hsnCode.replace(/\D/g, '') || null,
        gstRate: Number(f.gstRate),
        mrp: Number(f.mrp),
        purchasePrice: Number(f.purchasePrice),
        sellingPrice: Number(f.sellingPrice),
        listPrice: f.listPrice === '' ? null : Number(f.listPrice),
        minStock: Number(f.minStock) || 0,
        rackLocation: f.rackLocation.trim() || null,
        openingStock: isEdit ? null : Number(f.openingStock) || 0,
      }
      return isEdit ? api.put(`/products/${product!.id}`, body) : api.post('/products', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product-live'] }) // unfinished bills, purchases and quotations pick up the new values
      onClose()
    },
    onError: (e) => {
      const { errors: fieldErrors, general: rest } = splitServerMessage(errorMessage(e))
      setErrors(fieldErrors)
      setGeneral(rest)
    },
  })

  const submit = () => {
    setGeneral([])
    const found = validate(f, isEdit)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    save.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? `Edit ${product!.partNumber}` : 'Add product'}</DialogTitle>
      <DialogContent>
        {general.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>{general.join('. ')}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
          <TextField label="Part number" autoFocus required {...field('partNumber')} />
          <TextField label="Name" required {...field('name')} />
          <TextField label="Brand" {...dropdown('brandId')}>
            <MenuItem value="">None</MenuItem>
            {brands.map((b) => <MenuItem key={b.id} value={b.id.toString()}>{b.name}</MenuItem>)}
          </TextField>
          <TextField label="Category" {...dropdown('categoryId')}>
            <MenuItem value="">None</MenuItem>
            {categories.map((c) => <MenuItem key={c.id} value={c.id.toString()}>{c.name}</MenuItem>)}
          </TextField>
          <TextField label="Vehicle compatibility" sx={{ gridColumn: { sm: '1 / -1' } }}
            {...field('vehicleCompatibility', 'e.g. Maruti Swift 2012-2018, Dzire 2012-2017')} />
          <TextField label="HSN code" {...field('hsnCode', 'Numbers only, 4 to 8 digits')} />
          <TextField label="GST %" type="number" required {...field('gstRate')} />

          <Typography variant="caption" color="text.secondary" sx={{ gridColumn: { sm: '1 / -1' }, mt: 1 }}>
            Type the list price (from the supplier's price list, before GST) and your discount. The purchase price,
            selling price and MRP fill in by themselves. You can still change any box afterwards.
          </Typography>
          <TextField label="List price (before GST)" type="number" {...field('listPrice', 'Optional. The rate on your quotation')} />
          <TextField label="Supplier discount %" type="number" {...field('discount', 'Your discount from the list price')} />
          <TextField label="Purchase price (before GST)" type="number" required
            {...field('purchasePrice', 'What you pay the supplier per piece')} />
          <TextField label="Selling price (GST inclusive)" type="number" required {...field('sellingPrice', sellingBeforeGst)} />
          <TextField label="MRP" type="number" required {...field('mrp')} />
          <TextField label="Minimum stock (alert level)" type="number" {...field('minStock')} />
          <TextField label="Rack location" {...field('rackLocation')} />
          {!isEdit && (
            <TextField label="Opening stock" type="number"
              {...field('openingStock', 'Quantity already on the shelf today')} />
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
