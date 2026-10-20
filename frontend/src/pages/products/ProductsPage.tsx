import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, IconButton, InputAdornment, MenuItem, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import EditIcon from '@mui/icons-material/Edit'
import TuneIcon from '@mui/icons-material/Tune'
import BlockIcon from '@mui/icons-material/Block'
import RestoreIcon from '@mui/icons-material/Restore'
import { api, errorMessage } from '../../api/client'
import { inr, type NameItem, type PageResponse, type Product } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'
import ProductFormDialog from './ProductFormDialog'
import StockAdjustDialog from './StockAdjustDialog'

export default function ProductsPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [formFor, setFormFor] = useState<Product | 'new' | null>(null)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [actionError, setActionError] = useState('')

  const q = useDebounce(search.trim())

  const brands = useQuery({ queryKey: ['brands'], queryFn: async () => (await api.get<NameItem[]>('/brands')).data })
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get<NameItem[]>('/categories')).data })

  const products = useQuery({
    queryKey: ['products', q, brandId, categoryId, includeInactive, page, size],
    queryFn: async () =>
      (await api.get<PageResponse<Product>>('/products', {
        params: {
          q: q || undefined,
          brandId: brandId || undefined,
          categoryId: categoryId || undefined,
          includeInactive,
          page,
          size,
        },
      })).data,
    placeholderData: keepPreviousData,
  })

  const toggleActive = useMutation({
    mutationFn: (p: Product) => api.patch(`/products/${p.id}/active`, null, { params: { value: !p.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (e) => setActionError(errorMessage(e)),
  })

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0) }
  const rows = products.data?.content ?? []

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Products</Typography>
        {isOwner && <Button variant="contained" onClick={() => setFormFor('new')}>Add product</Button>}
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField autoFocus size="small" sx={{ minWidth: 320, flexGrow: 1 }}
          placeholder="Search part number, name, vehicle or brand (e.g. brake swift bosch)"
          value={search} onChange={(e) => resetPage(setSearch)(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        <TextField select size="small" label="Brand" sx={{ minWidth: 150 }} value={brandId}
          onChange={(e) => resetPage(setBrandId)(e.target.value)}>
          <MenuItem value="">All</MenuItem>
          {brands.data?.map((b) => <MenuItem key={b.id} value={b.id.toString()}>{b.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Category" sx={{ minWidth: 150 }} value={categoryId}
          onChange={(e) => resetPage(setCategoryId)(e.target.value)}>
          <MenuItem value="">All</MenuItem>
          {categories.data?.map((c) => <MenuItem key={c.id} value={c.id.toString()}>{c.name}</MenuItem>)}
        </TextField>
        {isOwner && (
          <FormControlLabel label="Show inactive"
            control={<Checkbox checked={includeInactive} onChange={(e) => resetPage(setIncludeInactive)(e.target.checked)} />} />
        )}
      </Paper>

      {products.error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(products.error)}</Alert>}
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>{actionError}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Part no.</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Brand</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Vehicles</TableCell>
              <TableCell align="right">Stock</TableCell>
              <TableCell>Rack</TableCell>
              <TableCell align="right">MRP</TableCell>
              <TableCell align="right">Selling</TableCell>
              {isOwner && <TableCell align="right">Purchase</TableCell>}
              {isOwner && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} hover sx={{ opacity: p.active ? 1 : 0.5 }}>
                <TableCell sx={{ fontWeight: 600 }}>{p.partNumber}</TableCell>
                <TableCell>
                  {p.name} {!p.active && <Chip size="small" label="Inactive" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell>{p.brandName}</TableCell>
                <TableCell>{p.categoryName}</TableCell>
                <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={p.vehicleCompatibility ?? ''}>
                  {p.vehicleCompatibility}
                </TableCell>
                <TableCell align="right">
                  <Chip size="small" label={p.stockQty}
                    color={p.stockQty <= 0 ? 'error' : p.lowStock ? 'warning' : 'default'} />
                </TableCell>
                <TableCell>{p.rackLocation}</TableCell>
                <TableCell align="right">{inr(p.mrp)}</TableCell>
                <TableCell align="right">{inr(p.sellingPrice)}</TableCell>
                {isOwner && <TableCell align="right">{inr(p.purchasePrice)}</TableCell>}
                {isOwner && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => setFormFor(p)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Adjust stock"><IconButton size="small" onClick={() => setAdjusting(p)}><TuneIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={p.active ? 'Deactivate' : 'Activate'}>
                      <IconButton size="small" onClick={() => toggleActive.mutate(p)}>
                        {p.active ? <BlockIcon fontSize="small" /> : <RestoreIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!products.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={isOwner ? 11 : 9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No products found
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={products.data?.totalElements ?? 0}
          page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={size} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}
          rowsPerPageOptions={[20, 50, 100]} />
      </TableContainer>

      {formFor && (
        <ProductFormDialog
          key={formFor === 'new' ? 'new' : formFor.id}
          product={formFor === 'new' ? null : formFor}
          brands={brands.data ?? []} categories={categories.data ?? []}
          onClose={() => setFormFor(null)} />
      )}
      {adjusting && <StockAdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />}
    </>
  )
}