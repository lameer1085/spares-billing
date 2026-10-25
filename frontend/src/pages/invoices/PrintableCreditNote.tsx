import { amountInWords, fmtDate } from '../../utils/format'
import type { CreditNoteFull } from '../../api/types'

const n2 = (n: number | null | undefined) => (n ?? 0).toFixed(2)

export default function PrintableCreditNote({ cn, mode }: { cn: CreditNoteFull; mode: 'a4' | 'receipt' }) {
  const igst = cn.igstTotal > 0
  const buyer = cn.customer

  if (mode === 'receipt') {
    return (
      <div className="receipt">
        <style>{'@page { size: 80mm auto; margin: 2mm; }'}</style>
        <div className="center" style={{ fontWeight: 700, fontSize: 14 }}>{cn.shop.shopName}</div>
        <div className="center">{cn.shop.address}</div>
        {cn.shop.gstin && <div className="center">GSTIN: {cn.shop.gstin}</div>}
        <div className="center" style={{ fontWeight: 700, marginTop: 4 }}>CREDIT NOTE</div>
        <hr />
        <div>No: {cn.creditNoteNo}</div>
        <div>Date: {fmtDate(cn.creditNoteDate)}</div>
        <div>Against bill: {cn.invoiceNo} ({fmtDate(cn.invoiceDate)})</div>
        <div>Customer: {buyer?.name ?? 'Walk-in'}</div>
        <hr />
        <table>
          <tbody>
            {cn.items.map((l, i) => (
              <tr key={i}>
                <td>{l.description}<br />Qty {l.quantity}</td>
                <td className="num" style={{ verticalAlign: 'bottom' }}>{n2(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        <table>
          <tbody>
            <tr><td>Taxable</td><td className="num">{n2(cn.taxableAmount)}</td></tr>
            {igst ? <tr><td>IGST</td><td className="num">{n2(cn.igstTotal)}</td></tr> : (
              <>
                <tr><td>CGST</td><td className="num">{n2(cn.cgstTotal)}</td></tr>
                <tr><td>SGST</td><td className="num">{n2(cn.sgstTotal)}</td></tr>
              </>
            )}
            <tr><td>Round off</td><td className="num">{n2(cn.roundOff)}</td></tr>
            <tr style={{ fontWeight: 700, fontSize: 13 }}><td>CREDIT TOTAL</td><td className="num">{n2(cn.grandTotal)}</td></tr>
            {cn.refundAmount > 0 && (
              <tr><td>Refunded ({cn.refundMethod})</td><td className="num">{n2(cn.refundAmount)}</td></tr>
            )}
          </tbody>
        </table>
        <hr />
        <div>Reason: {cn.reason}</div>
      </div>
    )
  }

  return (
    <div className="a4">
      <style>{'@page { size: A4; margin: 12mm; }'}</style>
      <div className="center" style={{ fontSize: 18, fontWeight: 700 }}>CREDIT NOTE</div>
      <div className="center" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{cn.shop.shopName}</div>
      <div className="center">{cn.shop.address}</div>
      <div className="center">
        {[cn.shop.phone && `Ph: ${cn.shop.phone}`, cn.shop.gstin && `GSTIN: ${cn.shop.gstin}`,
          cn.shop.stateName && `State: ${cn.shop.stateName}`].filter(Boolean).join('   |   ')}
      </div>

      <table style={{ marginTop: 10 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}>
              <b>Credit note no:</b> {cn.creditNoteNo}<br />
              <b>Date:</b> {fmtDate(cn.creditNoteDate)}<br />
              <b>Against invoice:</b> {cn.invoiceNo} dated {fmtDate(cn.invoiceDate)}<br />
              <b>Place of supply:</b> {cn.placeOfSupplyName ?? ''}
            </td>
            <td>
              <b>Customer:</b> {buyer?.name ?? 'Walk-in customer'}<br />
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
            <th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Taxable</th><th>GST%</th>
            {igst ? <th>IGST</th> : <><th>CGST</th><th>SGST</th></>}
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {cn.items.map((l, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{l.description}</td>
              <td>{l.hsnCode}</td>
              <td className="num">{l.quantity}</td>
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
              <b>Amount in words:</b><br />{amountInWords(cn.grandTotal)}
              <br /><br />
              <b>Reason:</b> {cn.reason}
            </td>
            <td style={{ padding: 0 }}>
              <table>
                <tbody>
                  <tr><td>Taxable value</td><td className="num">{n2(cn.taxableAmount)}</td></tr>
                  {igst ? <tr><td>IGST</td><td className="num">{n2(cn.igstTotal)}</td></tr> : (
                    <>
                      <tr><td>CGST</td><td className="num">{n2(cn.cgstTotal)}</td></tr>
                      <tr><td>SGST</td><td className="num">{n2(cn.sgstTotal)}</td></tr>
                    </>
                  )}
                  <tr><td>Round off</td><td className="num">{n2(cn.roundOff)}</td></tr>
                  <tr style={{ fontWeight: 700 }}><td>Credit total</td><td className="num">{n2(cn.grandTotal)}</td></tr>
                  <tr><td>Refunded{cn.refundMethod && cn.refundAmount > 0 ? ` (${cn.refundMethod})` : ''}</td>
                    <td className="num">{n2(cn.refundAmount)}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="num" style={{ marginTop: 40 }}>For {cn.shop.shopName}<br /><br />Authorised signatory</div>
    </div>
  )
}