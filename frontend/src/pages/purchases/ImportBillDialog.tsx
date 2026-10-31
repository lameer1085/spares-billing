import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type NameItem, type PageResponse, type Product } from '../../api/types'
import { usePersistentState } from '../../hooks/usePersistentState'

export interface ImportedRow {
  product: Product
  qty: number
  list: number
  disc: number
  gst: number
  sell: number
}

interface Parsed {
  part: string; name: string; hsn: string; qty: number; list: number; disc: number; gst: number; problem: string
}
interface Row extends Parsed { existing: Product | null }

// 1-based column numbers in the pasted rows. 0 means the sheet has no such column.
// The defaults match your supplier's bill layout.
const DEFAULT_MAP = { part: 2, name: 3, hsn: 4, qty: 5, list: 7, disc: 9, cgst: 12, sgst: 14, igst: 16 }
type MapKey = keyof typeof DEFAULT_MAP
const LABELS: Record<MapKey, string> = {
  part: 'Part number', name: 'Description', hsn: 'HSN', qty: 'Quantity', list: 'List rate',
  disc: 'Discount %', cgst: 'CGST %', sgst: 'SGST %', igst: 'IGST %',
}

const r2 = (n: number) => Math.round(n * 100) / 100
const num = (s: string) => {
  const n = Number(s.replace(/[,%₹\s]/g, ''))
  return s.trim() === '' || !Number.isFinite(n) ? NaN : n
}
// "9 %" and "9" mean 9. "0.09" (a fraction, as in some sheets) also means 9.
const pct = (s: string) => {
  const n = num(s)
  if (Number.isNaN(n)) return 0
  return n > 0 && n <= 1 ? r2(n * 100) : n
}

function parse(text: string, m: typeof DEFAULT_MAP, fallbackGst: number): Parsed[] {
  const out: Parsed[] = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const c = raw.split('\t')
    const at = (i: number) => (i > 0 ? (c[i - 1] ?? '').trim() : '')
    const qty = num(at(m.qty))
    const list = num(at(m.list))
    if (Number.isNaN(qty) || Number.isNaN(list)) continue        // heading and blank rows are skipped
    const igst = pct(at(m.igst))
    const split = pct(at(m.cgst)) + pct(at(m.sgst))
    const gst = r2(igst > 0 ? igst : split > 0 ? split : fallbackGst)
    const disc = Number.isNaN(num(at(m.disc))) ? 0 : num(at(m.disc))
    const part = at(m.part)
    let problem = ''
    if (!part) problem = 'Part number is missing'
    else if (!Number.isInteger(qty) || qty < 1) problem = 'Quantity must be a whole number, 1 or more'
    else if (list <= 0) problem = 'List rate is missing'
    else if (disc < 0 || disc > 100) problem = 'Discount must be 0 to 100'
    else if (gst < 0 || gst > 40) problem = 'GST must be 0 to 40'
    out.push({
      part, name: at(m.name).slice(0, 200), hsn: at(m.hsn).replace(/\D/g, '').slice(0, 8),
      qty, list, disc, gst, problem,
    })
  }
  return out
}

// The same part on two lines becomes one line (quantities added)
function mergeDuplicates(rows: Parsed[]): Parsed[] {
  const byPart = new Map<string, Parsed>()
  const out: Parsed[] = []
  for (const r of rows) {
    const key = r.part.toLowerCase()
    const first = key ? byPart.get(key) : undefined
    if (first && !first.problem && !r.problem) first.qty += r.qty
    else {
      const copy = { ...r }
      if (key && !first) byPart.set(key, copy)
      out.push(copy)
    }
  }
  return out
}

export default function ImportBillDialog({
  onClose, onImport,
}: { onClose: () => void; onImport: (rows: ImportedRow[]) => void }) {
  const [text, setText] = useState('')
  const [map, setMap] = usePersistentState<typeof DEFAULT_MAP>('spares_import_map', DEFAULT_MAP)
  const [fallbackGst, setFallbackGst] = useState('18')
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [updateSell, setUpdateSell] = useState(true)
  const [showMap, setShowMap] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const brands = useQuery({ queryKey: ['brands'], queryFn: async () => (await api.get<NameItem[]>('/brands')).data })
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get<NameItem[]>('/categories')).data })

  const read = async () => {
    setError('')
    setBusy(true)
    try {
      const parsed = mergeDuplicates(parse(text, map, Number(fallbackGst) || 18))
      if (parsed.length === 0) {
        setError('No rows found. Copy the item rows from Excel (with the part number, quantity and rate columns) and paste them here. Check the column numbers under "Column numbers".')
        return
      }
      const found = new Map<string, Product | null>()
      const unique = [...new Set(parsed.filter((p) => p.part).map((p) => p.part))]
      for (let i = 0; i < unique.length; i += 6) {
        await Promise.all(unique.slice(i, i + 6).map(async (part) => {
          const res = await api.get<PageResponse<Product>>('/products', {
            params: { q: part, includeInactive: true, size: 20 },
          })
          found.set(part.toLowerCase(),
            res.data.content.find((p) => p.partNumber.toLowerCase() === part.toLowerCase()) ?? null)
        }))
      }
      setRows(parsed.map((p) => {
        const existing = found.get(p.part.toLowerCase()) ?? null
        const problem = p.problem || (existing && !existing.active ? 'Part is inactive. Reactivate it in Products first' : '')
        return { ...p, existing, problem }
      }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!rows) return
    setBusy(true)
    setError('')
    const result: ImportedRow[] = []
    const failures: string[] = []
    const next = [...rows]
    for (const r of rows.filter((x) => !x.problem)) {
      const sell = r2(r.list * (1 + r.gst / 100))
      const cost = r2(r.list * (1 - r.disc / 100))
      let product: Product | null = r.existing
      if (!product) {
        try {
          product = (await api.post<Product>('/products', {
            partNumber: r.part, name: r.name || r.part,
            brandId: brandId ? Number(brandId) : null, categoryId: categoryId ? Number(categoryId) : null,
            vehicleCompatibility: null, hsnCode: r.hsn || null, gstRate: r.gst,
            mrp: sell, purchasePrice: cost, sellingPrice: sell, listPrice: r.list,
            minStock: 0, rackLocation: null, openingStock: 0,
          })).data
          const i = next.findIndex((x) => x.part === r.part)
          if (i >= 0) next[i] = { ...next[i], existing: product }
        } catch (e) {
          failures.push(`${r.part}: ${errorMessage(e)}`)
          continue
        }
      }
      if (!product) continue
      result.push({
        product, qty: r.qty, list: r.list, disc: r.disc, gst: r.gst,
        sell: !r.existing || updateSell ? sell : product.sellingPrice,
      })
    }
    setRows(next)
    setBusy(false)
    if (failures.length > 0) {
      setError(`Some parts could not be created, so nothing was added yet. ${failures.join('. ')}. Fix the cause and press the button again: parts that were created are kept.`)
      return
    }
    onImport(result)
  }

  const good = rows?.filter((r) => !r.problem) ?? []
  const fresh = good.filter((r) => !r.existing).length

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Import from your supplier's bill</DialogTitle>
      <DialogContent>
        {!rows && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              In Excel, select the item rows of the bill (not the heading), copy, and paste below. New part numbers are
              created for you; known ones are added to the purchase.
            </Alert>
            <TextField multiline minRows={8} maxRows={14} fullWidth autoFocus value={text}
              placeholder="Paste the rows here"
              onChange={(e) => setText(e.target.value)} slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
              <TextField select size="small" label="Brand for new parts" value={brandId} sx={{ minWidth: 200 }}
                onChange={(e) => setBrandId(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                <MenuItem value="">None</MenuItem>
                {brands.data?.map((b) => <MenuItem key={b.id} value={b.id.toString()}>{b.name}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Category for new parts" value={categoryId} sx={{ minWidth: 200 }}
                onChange={(e) => setCategoryId(e.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                <MenuItem value="">None</MenuItem>
                {categories.data?.map((c) => <MenuItem key={c.id} value={c.id.toString()}>{c.name}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label="GST % if the sheet has none" value={fallbackGst} sx={{ width: 190 }}
                onChange={(e) => setFallbackGst(e.target.value)} />
              <FormControlLabel
                control={<Checkbox checked={updateSell} onChange={(e) => setUpdateSell(e.target.checked)} />}
                label="Also reset selling price of known parts from the list rate" />
            </Box>
            <Button size="small" sx={{ mt: 1 }} onClick={() => setShowMap(!showMap)}>
              {showMap ? 'Hide column numbers' : 'Column numbers'}
            </Button>
            {showMap && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Which column of your sheet holds each thing (first column is 1, 0 = not in the sheet). Saved on this computer.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                  {(Object.keys(LABELS) as MapKey[]).map((k) => (
                    <TextField key={k} size="small" type="number" label={LABELS[k]} value={map[k]} sx={{ width: 120 }}
                      onChange={(e) => setMap({ ...map, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                  ))}
                  <Button size="small" onClick={() => setMap(DEFAULT_MAP)}>Reset</Button>
                </Box>
              </Box>
            )}
          </>
        )}

        {rows && (
          <>
            <Typography sx={{ mb: 1 }}>
              {good.length} line(s) ready: {good.length - fresh} known part(s), <b>{fresh} new part(s) will be created</b>.
              {rows.length - good.length > 0 && ` ${rows.length - good.length} line(s) have a problem and are left out.`}
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Part</TableCell><TableCell>Description</TableCell><TableCell>HSN</TableCell>
                    <TableCell align="right">Qty</TableCell><TableCell align="right">List</TableCell>
                    <TableCell align="right">Disc %</TableCell><TableCell align="right">GST %</TableCell>
                    <TableCell align="right">Cost</TableCell><TableCell align="right">Selling</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} sx={{ opacity: r.problem ? 0.6 : 1 }}>
                      <TableCell sx={{ fontWeight: 600 }}>{r.part}</TableCell>
                      <TableCell>{r.existing?.name ?? r.name}</TableCell>
                      <TableCell>{r.hsn}</TableCell>
                      <TableCell align="right">{r.qty}</TableCell>
                      <TableCell align="right">{inr(r.list)}</TableCell>
                      <TableCell align="right">{r.disc}</TableCell>
                      <TableCell align="right">{r.gst}</TableCell>
                      <TableCell align="right">{inr(r2(r.list * (1 - r.disc / 100)))}</TableCell>
                      <TableCell align="right">
                        {inr(r.existing && !updateSell ? r.existing.sellingPrice : r2(r.list * (1 + r.gst / 100)))}
                      </TableCell>
                      <TableCell>
                        {r.problem
                          ? <Chip size="small" color="error" label={r.problem} />
                          : r.existing
                            ? <Chip size="small" variant="outlined" label="Known part" />
                            : <Chip size="small" color="success" label="New part" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        {rows && <Button onClick={() => { setRows(null); setError('') }} disabled={busy}>Back</Button>}
        {!rows
          ? <Button variant="contained" onClick={read} disabled={busy || !text.trim()}>{busy ? 'Reading…' : 'Read rows'}</Button>
          : <Button variant="contained" onClick={confirm} disabled={busy || good.length === 0}>
              {busy ? 'Working…' : `Add ${good.length} line(s) to the purchase`}
            </Button>}
      </DialogActions>
    </Dialog>
  )
}
