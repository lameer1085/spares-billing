import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Box, Button, CircularProgress, MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import {
  inr, type GstSummary, type ProfitReport, type Product, type SalesReport, type StockReport, type TopProduct,
} from '../../api/types'
import StatCard from '../../components/StatCard'
import { downloadCsv } from '../../utils/csv'
import { fmtDate } from '../../utils/format'

interface RangeProps { from: string; to: string }
const num = (n: number | null | undefined) => (n ?? 0).toFixed(2)
const R = { align: 'right' as const }

function Loading({ q }: { q: { isLoading: boolean; error: unknown } }) {
  if (q.isLoading) return <CircularProgress />
  if (q.error) return <Alert severity="error">{errorMessage(q.error)}</Alert>
  return null
}

function Cards({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, mb: 3 }}>
      {children}
    </Box>
  )
}

// ------------------------------------------------------------------ SALES
export function SalesTab({ from, to }: RangeProps) {
  const q = useQuery({
    queryKey: ['report', 'sales', from, to],
    queryFn: async () => (await api.get<SalesReport>('/reports/sales', { params: { from, to } })).data,
  })
  const s = q.data

  return (
    <>
      <Loading q={q} />
      {s && (
        <>
          <Cards>
            <StatCard label="Sales (before returns)" value={inr(s.totals?.grandTotal)} hint={`${s.totals?.invoices ?? 0} bill(s)`} />
            <StatCard label="Returns (credit notes)" value={inr(s.returns?.grandTotal)} hint={`${s.returns?.creditNotes ?? 0} note(s)`} color="warning.dark" />
            <StatCard label="Net sales" value={inr(s.netSales)} color="success.main" />
            <StatCard label="Received on these bills" value={inr(s.totals?.paid)} />
            <StatCard label="Still due on these bills" value={inr(s.totals?.due)} />
            <StatCard label="Cancelled bills" value={inr(s.cancelledAmount)} hint={`${s.cancelledCount} bill(s), not counted above`} />
          </Cards>
          <Box sx={{ mb: 1 }}>
            <Button size="small" onClick={() => downloadCsv(`sales_${from}_to_${to}.csv`,
              ['Date', 'Bills', 'Discount', 'Taxable', 'CGST', 'SGST', 'IGST', 'Round off', 'Total', 'Paid', 'Due'],
              s.days.map((d) => [d.date, d.invoices, num(d.discount), num(d.taxable), num(d.cgst), num(d.sgst),
                num(d.igst), num(d.roundOff), num(d.grandTotal), num(d.paid), num(d.due)]))}>
              Download CSV
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell><TableCell {...R}>Bills</TableCell><TableCell {...R}>Discount</TableCell>
                  <TableCell {...R}>Taxable</TableCell><TableCell {...R}>CGST</TableCell><TableCell {...R}>SGST</TableCell>
                  <TableCell {...R}>IGST</TableCell><TableCell {...R}>Round off</TableCell>
                  <TableCell {...R}>Total</TableCell><TableCell {...R}>Paid</TableCell><TableCell {...R}>Due</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {s.days.map((d) => (
                  <TableRow key={d.date} hover>
                    <TableCell>{fmtDate(d.date)}</TableCell><TableCell {...R}>{d.invoices}</TableCell>
                    <TableCell {...R}>{inr(d.discount)}</TableCell><TableCell {...R}>{inr(d.taxable)}</TableCell>
                    <TableCell {...R}>{inr(d.cgst)}</TableCell><TableCell {...R}>{inr(d.sgst)}</TableCell>
                    <TableCell {...R}>{inr(d.igst)}</TableCell><TableCell {...R}>{inr(d.roundOff)}</TableCell>
                    <TableCell {...R}>{inr(d.grandTotal)}</TableCell><TableCell {...R}>{inr(d.paid)}</TableCell>
                    <TableCell {...R}>{inr(d.due)}</TableCell>
                  </TableRow>
                ))}
                {s.days.length === 0 && (
                  <TableRow><TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>No sales in this period</TableCell></TableRow>
                )}
                {s.days.length > 0 && (
                  <TableRow sx={{ '& td': { fontWeight: 700 } }}>
                    <TableCell>Total</TableCell><TableCell {...R}>{s.totals.invoices}</TableCell>
                    <TableCell {...R}>{inr(s.totals.discount)}</TableCell><TableCell {...R}>{inr(s.totals.taxable)}</TableCell>
                    <TableCell {...R}>{inr(s.totals.cgst)}</TableCell><TableCell {...R}>{inr(s.totals.sgst)}</TableCell>
                    <TableCell {...R}>{inr(s.totals.igst)}</TableCell><TableCell {...R}>{inr(s.totals.roundOff)}</TableCell>
                    <TableCell {...R}>{inr(s.totals.grandTotal)}</TableCell><TableCell {...R}>{inr(s.totals.paid)}</TableCell>
                    <TableCell {...R}>{inr(s.totals.due)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ GST
function TaxTable({ title, rows, totals }: { title: string; rows: GstSummary['output']; totals: GstSummary['outputTotals'] }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>{title}</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>GST rate</TableCell><TableCell {...R}>Taxable value</TableCell><TableCell {...R}>CGST</TableCell>
              <TableCell {...R}>SGST</TableCell><TableCell {...R}>IGST</TableCell><TableCell {...R}>Total tax</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.rate}>
                <TableCell>{r.rate}%</TableCell><TableCell {...R}>{inr(r.taxable)}</TableCell>
                <TableCell {...R}>{inr(r.cgst)}</TableCell><TableCell {...R}>{inr(r.sgst)}</TableCell>
                <TableCell {...R}>{inr(r.igst)}</TableCell><TableCell {...R}>{inr(r.totalTax)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>Nothing in this period</TableCell></TableRow>
            )}
            <TableRow sx={{ '& td': { fontWeight: 700 } }}>
              <TableCell>Total</TableCell><TableCell {...R}>{inr(totals?.taxable)}</TableCell>
              <TableCell {...R}>{inr(totals?.cgst)}</TableCell><TableCell {...R}>{inr(totals?.sgst)}</TableCell>
              <TableCell {...R}>{inr(totals?.igst)}</TableCell><TableCell {...R}>{inr(totals?.totalTax)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export function GstTab({ from, to }: RangeProps) {
  const q = useQuery({
    queryKey: ['report', 'gst', from, to],
    queryFn: async () => (await api.get<GstSummary>('/reports/gst', { params: { from, to } })).data,
  })
  const g = q.data

  return (
    <>
      <Loading q={q} />
      {g && (
        <>
          <Cards>
            <StatCard label="GST collected on sales (after returns)" value={inr(g.outputTotals?.totalTax)} />
            <StatCard label="GST paid on purchases" value={inr(g.inputTotals?.totalTax)} />
            <StatCard label="Estimated GST payable" value={inr(g.netTaxEstimate)}
              color={g.netTaxEstimate > 0 ? 'warning.dark' : 'success.main'}
              hint="Collected minus paid. Your accountant files the actual return." />
          </Cards>
          {(g.creditNotes?.totalTax ?? 0) > 0 && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Sales below are already reduced by credit notes in this period: taxable {inr(g.creditNotes.taxable)},
              GST {inr(g.creditNotes.totalTax)}.
            </Alert>
          )}
          <TaxTable title="Output tax: sales minus returns" rows={g.output} totals={g.outputTotals} />
          <TaxTable title="Input tax: purchases" rows={g.input} totals={g.inputTotals} />

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>HSN summary of sales</Typography>
            <Button size="small" onClick={() => downloadCsv(`hsn_${from}_to_${to}.csv`,
              ['HSN', 'GST rate', 'Quantity', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total tax'],
              g.hsnSales.map((h) => [h.hsn, h.rate, h.quantity, num(h.taxable), num(h.cgst), num(h.sgst), num(h.igst), num(h.totalTax)]))}>
              Download CSV
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>HSN</TableCell><TableCell {...R}>Rate</TableCell><TableCell {...R}>Qty</TableCell>
                  <TableCell {...R}>Taxable</TableCell><TableCell {...R}>CGST</TableCell><TableCell {...R}>SGST</TableCell>
                  <TableCell {...R}>IGST</TableCell><TableCell {...R}>Total tax</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {g.hsnSales.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell>{h.hsn ?? '(none)'}</TableCell><TableCell {...R}>{h.rate}%</TableCell>
                    <TableCell {...R}>{h.quantity}</TableCell><TableCell {...R}>{inr(h.taxable)}</TableCell>
                    <TableCell {...R}>{inr(h.cgst)}</TableCell><TableCell {...R}>{inr(h.sgst)}</TableCell>
                    <TableCell {...R}>{inr(h.igst)}</TableCell><TableCell {...R}>{inr(h.totalTax)}</TableCell>
                  </TableRow>
                ))}
                {g.hsnSales.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.secondary' }}>Nothing in this period</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ PROFIT
export function ProfitTab({ from, to }: RangeProps) {
  const q = useQuery({
    queryKey: ['report', 'profit', from, to],
    queryFn: async () => (await api.get<ProfitReport>('/reports/profit', { params: { from, to, limit: 100 } })).data,
  })
  const p = q.data

  return (
    <>
      <Loading q={q} />
      {p && (
        <>
          <Cards>
            <StatCard label="Revenue (excluding GST)" value={inr(p.revenue)} />
            <StatCard label="Cost of parts sold" value={inr(p.cost)} />
            <StatCard label="Profit" value={inr(p.profit)} color={p.profit >= 0 ? 'success.main' : 'error.main'}
              hint={`Margin ${num(p.marginPercent)}%`} />
          </Cards>
          <Alert severity="info" sx={{ mb: 3 }}>
            Cost is the purchase price saved on each bill at the time of sale. Returned parts that went back to
            stock reduce both revenue and cost. Damaged returns reduce revenue only, because that cost is a real loss.
          </Alert>

          <Typography variant="h6" sx={{ mb: 1 }}>By category</Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell><TableCell {...R}>Revenue</TableCell><TableCell {...R}>Cost</TableCell>
                  <TableCell {...R}>Profit</TableCell><TableCell {...R}>Margin</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {p.categories.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{c.category ?? 'Uncategorised'}</TableCell><TableCell {...R}>{inr(c.revenue)}</TableCell>
                    <TableCell {...R}>{inr(c.cost)}</TableCell><TableCell {...R}>{inr(c.profit)}</TableCell>
                    <TableCell {...R}>{num(c.marginPercent)}%</TableCell>
                  </TableRow>
                ))}
                {p.categories.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>No sales in this period</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>By part (most profitable first)</Typography>
            <Button size="small" onClick={() => downloadCsv(`profit_${from}_to_${to}.csv`,
              ['Part', 'Category', 'Qty', 'Revenue', 'Cost', 'Profit', 'Margin %'],
              p.products.map((r) => [r.description, r.category, r.quantity, num(r.revenue), num(r.cost), num(r.profit), num(r.marginPercent)]))}>
              Download CSV
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Part</TableCell><TableCell>Category</TableCell><TableCell {...R}>Qty</TableCell>
                  <TableCell {...R}>Revenue</TableCell><TableCell {...R}>Cost</TableCell>
                  <TableCell {...R}>Profit</TableCell><TableCell {...R}>Margin</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {p.products.map((r) => (
                  <TableRow key={r.productId} hover>
                    <TableCell>{r.description}</TableCell><TableCell>{r.category}</TableCell>
                    <TableCell {...R}>{r.quantity}</TableCell><TableCell {...R}>{inr(r.revenue)}</TableCell>
                    <TableCell {...R}>{inr(r.cost)}</TableCell>
                    <TableCell {...R} sx={{ color: r.profit < 0 ? 'error.main' : undefined }}>{inr(r.profit)}</TableCell>
                    <TableCell {...R}>{num(r.marginPercent)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ STOCK (no date range)
export function StockTab() {
  const q = useQuery({
    queryKey: ['report', 'stock'],
    queryFn: async () => (await api.get<StockReport>('/reports/stock')).data,
  })
  const low = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => (await api.get<Product[]>('/products/low-stock')).data,
  })
  const s = q.data

  return (
    <>
      <Loading q={q} />
      {s && (
        <>
          <Cards>
            <StatCard label="Stock value at cost" value={inr(s.costValue)} hint={`${s.units} units, ${s.products} parts`} />
            <StatCard label="Stock value at selling price" value={inr(s.sellingValue)} />
            <StatCard label="Out of stock" value={String(s.outOfStock)} color={s.outOfStock > 0 ? 'error.main' : undefined} />
            <StatCard label="Low stock" value={String(s.lowStock)} color={s.lowStock > 0 ? 'warning.dark' : undefined} />
          </Cards>
          <Typography variant="h6" sx={{ mb: 1 }}>By category</Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell><TableCell {...R}>Parts</TableCell><TableCell {...R}>Units</TableCell>
                  <TableCell {...R}>Cost value</TableCell><TableCell {...R}>Selling value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {s.categories.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{c.category ?? 'Uncategorised'}</TableCell><TableCell {...R}>{c.products}</TableCell>
                    <TableCell {...R}>{c.units}</TableCell><TableCell {...R}>{inr(c.costValue)}</TableCell>
                    <TableCell {...R}>{inr(c.sellingValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Parts to reorder</Typography>
        {low.data && low.data.length > 0 && (
          <Button size="small" onClick={() => downloadCsv('reorder_list.csv',
            ['Part no', 'Name', 'Brand', 'Stock', 'Minimum', 'Rack'],
            low.data!.map((p) => [p.partNumber, p.name, p.brandName, p.stockQty, p.minStock, p.rackLocation]))}>
            Download CSV
          </Button>
        )}
      </Box>
      <Loading q={low} />
      {low.data && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Part no.</TableCell><TableCell>Name</TableCell><TableCell>Brand</TableCell>
                <TableCell {...R}>Stock</TableCell><TableCell {...R}>Minimum</TableCell><TableCell>Rack</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {low.data.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{p.partNumber}</TableCell><TableCell>{p.name}</TableCell>
                  <TableCell>{p.brandName}</TableCell>
                  <TableCell {...R} sx={{ color: p.stockQty <= 0 ? 'error.main' : 'warning.dark', fontWeight: 600 }}>{p.stockQty}</TableCell>
                  <TableCell {...R}>{p.minStock}</TableCell><TableCell>{p.rackLocation}</TableCell>
                </TableRow>
              ))}
              {low.data.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>Nothing needs reordering</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  )
}

// ------------------------------------------------------------------ TOP PRODUCTS
export function TopTab({ from, to }: RangeProps) {
  const [by, setBy] = useState('quantity')
  const [limit, setLimit] = useState(10)
  const q = useQuery({
    queryKey: ['report', 'top', from, to, by, limit],
    queryFn: async () => (await api.get<TopProduct[]>('/reports/top-products', { params: { from, to, by, limit } })).data,
  })

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField select size="small" label="Rank by" value={by} onChange={(e) => setBy(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="quantity">Pieces sold</MenuItem>
          <MenuItem value="amount">Sales amount</MenuItem>
        </TextField>
        <TextField select size="small" label="Show" value={limit} onChange={(e) => setLimit(Number(e.target.value))} sx={{ minWidth: 100 }}>
          {[10, 25, 50].map((n) => <MenuItem key={n} value={n}>Top {n}</MenuItem>)}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        {q.data && q.data.length > 0 && (
          <Button size="small" onClick={() => downloadCsv(`top_products_${from}_to_${to}.csv`,
            ['Rank', 'Part', 'Pieces', 'Amount'],
            q.data!.map((r, i) => [i + 1, r.description, r.quantity, num(r.amount)]))}>
            Download CSV
          </Button>
        )}
      </Box>
      <Loading q={q} />
      {q.data && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell><TableCell>Part</TableCell><TableCell {...R}>Pieces sold</TableCell>
                <TableCell {...R}>Sales amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {q.data.map((r, i) => (
                <TableRow key={r.productId} hover>
                  <TableCell>{i + 1}</TableCell><TableCell>{r.description}</TableCell>
                  <TableCell {...R}>{r.quantity}</TableCell><TableCell {...R}>{inr(r.amount)}</TableCell>
                </TableRow>
              ))}
              {q.data.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No sales in this period</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  )
}