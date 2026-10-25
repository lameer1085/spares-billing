import { amountInWords, fmtDate } from '../../utils/format'
import type { InvoiceFull } from '../../api/types'

const n2 = (n: number | null | undefined) => (n ?? 0).toFixed(2)

export default function PrintableInvoice({
inv,
mode,
ewayNo,
}: {
inv: InvoiceFull
mode: 'a4' | 'receipt'
ewayNo?: string | null
}) {  const igst = inv.igstTotal > 0
  const cancelled = inv.status === 'CANCELLED'
  const buyer = inv.customer

  if (mode === 'receipt') {
    return (
      <div className="receipt">
        <style>{'@page { size: 80mm auto; margin: 2mm; }'}</style>
        {cancelled && <div className="watermark">CANCELLED</div>}
        <div className="center" style={{ fontWeight: 700, fontSize: 14 }}>{inv.shop.shopName}</div>
        <div className="center">{inv.shop.address}</div>
        {inv.shop.phone && <div className="center">Ph: {inv.shop.phone}</div>}
        {inv.shop.gstin && <div className="center">GSTIN: {inv.shop.gstin}</div>}
        <hr />
        <div>Bill: {inv.invoiceNo}</div>
        <div>Date: {fmtDate(inv.invoiceDate)}</div>
        <div>Customer: {buyer?.name ?? 'Walk-in'}</div>
        <hr />
        <table>
          <tbody>
            {inv.items.map((l, i) => (
              <tr key={i}>
                <td colSpan={2}>
                  {l.description}
                  <br />
                  {l.quantity} x {n2(l.unitPrice)}{l.discountAmount > 0 ? ` (-${n2(l.discountAmount)})` : ''}
                </td>
                <td className="num" style={{ verticalAlign: 'bottom' }}>{n2(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        <table>
          <tbody>
            <tr><td>Taxable</td><td className="num">{n2(inv.taxableAmount)}</td></tr>
            {igst ? (
              <tr><td>IGST</td><td className="num">{n2(inv.igstTotal)}</td></tr>
            ) : (
              <>
                <tr><td>CGST</td><td className="num">{n2(inv.cgstTotal)}</td></tr>
                <tr><td>SGST</td><td className="num">{n2(inv.sgstTotal)}</td></tr>
              </>
            )}
            {inv.roundOff !== 0 && <tr><td>Round off</td><td className="num">{n2(inv.roundOff)}</td></tr>}
            <tr style={{ fontWeight: 700, fontSize: 13 }}><td>TOTAL</td><td className="num">{n2(inv.grandTotal)}</td></tr>
            <tr><td>Paid</td><td className="num">{n2(inv.paidAmount)}</td></tr>
            {inv.dueAmount > 0 && <tr><td>Due</td><td className="num">{n2(inv.dueAmount)}</td></tr>}
          </tbody>
        </table>
        <hr />
        <div className="center">Prices include GST. Thank you, visit again!</div>
      </div>
    )
  }

  return (
    <div className="a4">
      <style>{'@page { size: A4; margin: 12mm; }'}</style>
      {cancelled && <div className="watermark">CANCELLED</div>}
      <div className="center" style={{ fontSize: 18, fontWeight: 700 }}>
        {inv.shop.gstin ? 'TAX INVOICE' : 'INVOICE'}
      </div>
      <div className="center" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{inv.shop.shopName}</div>
      <div className="center">{inv.shop.address}</div>
      <div className="center">
        {[inv.shop.phone && `Ph: ${inv.shop.phone}`, inv.shop.gstin && `GSTIN: ${inv.shop.gstin}`,
          inv.shop.stateName && `State: ${inv.shop.stateName}`].filter(Boolean).join('   |   ')}
      </div>

      <table style={{ marginTop: 10 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}>
              <b>Invoice no:</b> {inv.invoiceNo}<br />
              <b>Date:</b> {fmtDate(inv.invoiceDate)}<br />
              <b>Place of supply:</b> {inv.placeOfSupplyName ?? ''}
            </td>
            <td>
              <b>Bill to:</b> {buyer?.name ?? 'Walk-in customer'}<br />
              {buyer?.address && <>{buyer.address}<br /></>}
              {buyer?.phone && <>Ph: {buyer.phone}<br /></>}
              {buyer?.gstin && <>GSTIN: {buyer.gstin}</>}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Disc</th>
            <th>Taxable</th><th>GST%</th>
            {igst ? <th>IGST</th> : <><th>CGST</th><th>SGST</th></>}
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((l, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{l.description}</td>
              <td>{l.hsnCode}</td>
              <td className="num">{l.quantity}</td>
              <td className="num">{n2(l.unitPrice)}</td>
              <td className="num">{n2(l.discountAmount)}</td>
              <td className="num">{n2(l.taxableAmount)}</td>
              <td className="num">{l.gstRate}</td>
              {igst ? <td className="num">{n2(l.igstAmount)}</td>
                : <><td className="num">{n2(l.cgstAmount)}</td><td className="num">{n2(l.sgstAmount)}</td></>}
              <td className="num">{n2(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ marginTop: 10 }}>
        <tbody>
          <tr>
            <td style={{ width: '58%', verticalAlign: 'top' }}>
              <b>Amount in words:</b><br />{amountInWords(inv.grandTotal)}
              <br /><br />
              <small>Rates are inclusive of GST. Goods once sold will not be taken back without a bill.</small>
            </td>
            <td style={{ padding: 0 }}>
              <table>
                <tbody>
                  <tr><td>Taxable value</td><td className="num">{n2(inv.taxableAmount)}</td></tr>
                  {igst ? (
                    <tr><td>IGST</td><td className="num">{n2(inv.igstTotal)}</td></tr>
                  ) : (
                    <>
                      <tr><td>CGST</td><td className="num">{n2(inv.cgstTotal)}</td></tr>
                      <tr><td>SGST</td><td className="num">{n2(inv.sgstTotal)}</td></tr>
                    </>
                  )}
                  <tr><td>Round off</td><td className="num">{n2(inv.roundOff)}</td></tr>
                  <tr style={{ fontWeight: 700 }}><td>Grand total</td><td className="num">{n2(inv.grandTotal)}</td></tr>
                  <tr><td>Paid</td><td className="num">{n2(inv.paidAmount)}</td></tr>
                  <tr><td>Balance due</td><td className="num">{n2(inv.dueAmount)}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="num" style={{ marginTop: 40 }}>For {inv.shop.shopName}<br /><br />Authorised signatory</div>
    </div>
  )
}