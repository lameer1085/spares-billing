import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Table,
  TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material'
import { api, errorMessage } from '../../api/client'
import { inr, type CreditNoteFull } from '../../api/types'
import { fmtDate } from '../../utils/format'
import PrintableCreditNote from './PrintableCreditNote'

export default function CreditNoteDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const [printMode, setPrintMode] = useState<'a4' | 'receipt' | null>(null)

  const { data: cn, isLoading, error } = useQuery({
    queryKey: ['credit-note', id],
    queryFn: async () => (await api.get<CreditNoteFull>(`/credit-notes/${id}`)).data,
  })

  useEffect(() => {
    if (!printMode) return
    const t = setTimeout(() => { window.print(); setPrintMode(null) }, 150)
    return () => clearTimeout(t)
  }, [printMode])

  const igst = (cn?.igstTotal ?? 0) > 0

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>{cn?.creditNoteNo ?? 'Credit note'}</DialogTitle>
        <DialogContent>
          {isLoading && <CircularProgress />}
          {error && <Alert severity="error">{errorMessage(error)}</Alert>}
          {cn && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Box>
                  <Typography><b>Date:</b> {fmtDate(cn.creditNoteDate)}</Typography>
                  <Typography><b>Against invoice:</b> {cn.invoiceNo} ({fmtDate(cn.invoiceDate)})</Typography>
                  <Typography><b>Customer:</b> {cn.customer?.name ?? 'Walk-in'}</Typography>
                  <Typography><b>Reason:</b> {cn.reason}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{inr(cn.grandTotal)}</Typography>
                  {cn.refundAmount > 0
                    ? <Chip color="warning" label={`Refunded ${inr(cn.refundAmount)} (${cn.refundMethod})`} />
                    : <Chip variant="outlined" label="No cash refunded" />}
                </Box>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell><TableCell>HSN</TableCell>
                    <TableCell align="right">Qty</TableCell><TableCell align="right">Taxable</TableCell>
                    <TableCell align="right">GST</TableCell>
                    <TableCell align="right">{igst ? 'IGST' : 'CGST + SGST'}</TableCell>
                    <TableCell align="right">Amount</TableCell><TableCell>Stock</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cn.items.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>{l.description}</TableCell>
                      <TableCell>{l.hsnCode}</TableCell>
                      <TableCell align="right">{l.quantity}</TableCell>
                      <TableCell align="right">{inr(l.taxableAmount)}</TableCell>
                      <TableCell align="right">{l.gstRate}%</TableCell>
                      <TableCell align="right">
                        {igst ? inr(l.igstAmount) : `${inr(l.cgstAmount)} + ${inr(l.sgstAmount)}`}
                      </TableCell>
                      <TableCell align="right">{inr(l.lineTotal)}</TableCell>
                      <TableCell>{l.restocked ? 'Back in stock' : 'Damaged'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={!cn} onClick={() => setPrintMode('receipt')}>Print receipt</Button>
          <Button variant="contained" disabled={!cn} onClick={() => setPrintMode('a4')}>Print A4</Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      {cn && printMode && createPortal(
        <div id="print-root"><PrintableCreditNote cn={cn} mode={printMode} /></div>,
        document.body,
      )}
    </>
  )
}