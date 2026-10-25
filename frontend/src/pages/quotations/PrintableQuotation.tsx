import { amountInWords, fmtDate } from '../../utils/format'
import type { QuotationFull } from '../../api/types'

const n2 = (n: number | null | undefined) => (n ?? 0).toFixed(2)

export default function PrintableQuotation({ q }: { q: QuotationFull }) {
  const intra = q.sameState
  const cancelled = q.status === 'CANCELLED'
  const shopState = q.shop.stateName ?? ''

  return (
    <div className="a4" style={{ fontSize: 10 }}>
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
      {cancelled && <div className="watermark">CANCELLED</div>}

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{q.shop.shopName}</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{q.shop.address}{q.shop.pincode ? ` - ${q.shop.pincode}` : ''}</div>
          <div>
            {[q.shop.phone && `Ph: ${q.shop.phone}`, q.shop.gstin && `GSTIN: ${q.shop.gstin}`,
              shopState && `State: ${shopState}${q.shop.stateCode ? ` (${q.shop.stateCode})` : ''}`]
              .filter(Boolean).join('   |   ')}
          </div>
        </div>
        <div style={{ border: '2px solid #000', padding: '6px 12px', textAlign: 'center', minWidth: 230 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>QUOTATION</div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{q.quotationNo}{q.revision > 1 ? `  (Rev ${q.revision})` : ''}</div>
          <div>Date: {fmtDate(q.quotationDate)}</div>
          <div style={{ fontWeight: 700 }}>Valid until: {fmtDate(q.validUntil)}</div>
        </div>
      </div>

      {/* BUYER */}
      <div style={{ display: 'flex', border: '1px solid #444', marginTop: 8 }}>
        <div style={{ flex: 1, padding: 6, borderRight: '1px solid #444' }}>
          <div style={{ fontWeight: 700 }}>To:</div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{q.buyerName}</div>
          {q.buyerAddress && <div style={{ whiteSpace: 'pre-wrap' }}>{q.buyerAddress}</div>}
          {q.buyerPhone && <div>Ph: {q.buyerPhone}</div>}
          {q.buyerGstin && <div>GSTIN: {q.buyerGstin}</div>}
        </div>
        <div style={{ flex: 1, padding: 6 }}>
          <div><b>Dispatch from:</b> {shopState}</div>
          <div><b>Place of supply / dispatch to:</b> {q.placeOfSupplyName} ({q.placeOfSupply})</div>
          <div><b>Tax applied:</b> {intra ? 'CGST + SGST (supply within the same state)' : 'IGST (supply to another state)'}</div>
        </div>
      </div>

      {/* ITEMS */}
      <table style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Sr</th><th>Part no</th><th>Description</th><th>HSN</th><th>Qty</th><th>Unit</th>
            <th>Rate (excl. GST)</th><th>Value</th><th>Disc %</th><th>Disc amount</th><th>Taxable value</th>
            <th>GST %</th>
            {intra ? <><th>CGST</th><th>SGST</th></> : <th>IGST</th>}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {q.items.map((l) => (
            <tr key={l.lineNo}>
              <td className="center">{l.lineNo}</td>
              <td>{l.partNumber}</td>
              <td>{l.description}</td>
              <td>{l.hsnCode}</td>
              <td className="num">{l.quantity}</td>
              <td>{l.unit}</td>
              <td className="num">{n2(l.unitPrice)}</td>
              <td className="num">{n2(l.grossAmount)}</td>
              <td className="num">{n2(l.discountPercent)}</td>
              <td className="num">{n2(l.discountAmount)}</td>
              <td className="num">{n2(l.taxableAmount)}</td>
              <td className="num">{l.gstRate}</td>
              {intra
                ? <><td className="num">{n2(l.cgstAmount)}</td><td className="num">{n2(l.sgstAmount)}</td></>
                : <td className="num">{n2(l.igstAmount)}</td>}
              <td className="num">{n2(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* FOOTER */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div><b>Amount in words:</b> {amountInWords(q.grandTotal)}</div>
          {q.terms && (
            <div style={{ marginTop: 8 }}>
              <b>Terms and conditions</b>
              <div style={{ whiteSpace: 'pre-wrap' }}>{q.terms}</div>
            </div>
          )}
          {(q.shop.bankAccountNo || q.shop.upiId) && (
            <div style={{ marginTop: 8 }}>
              <b>Bank details</b>
              {q.shop.bankAccountName && <div>Account name: {q.shop.bankAccountName}</div>}
              {q.shop.bankName && <div>Bank and branch: {q.shop.bankName}</div>}
              {q.shop.bankAccountNo && <div>Account number: {q.shop.bankAccountNo}</div>}
              {q.shop.bankIfsc && <div>IFSC: {q.shop.bankIfsc}</div>}
              {q.shop.upiId && <div>UPI: {q.shop.upiId}</div>}
            </div>
          )}
          {q.notes && (
            <div style={{ marginTop: 8 }}>
              <b>Notes</b>
              <div style={{ whiteSpace: 'pre-wrap' }}>{q.notes}</div>
            </div>
          )}
        </div>
        <div style={{ width: 300 }}>
          <table>
            <tbody>
              <tr><td>Total value</td><td className="num">{n2(q.subtotal)}</td></tr>
              <tr><td>Less: discount</td><td className="num">{n2(q.discountTotal)}</td></tr>
              <tr><td>Total before tax</td><td className="num">{n2(q.taxableAmount)}</td></tr>
              {intra ? (
                <>
                  <tr><td>CGST</td><td className="num">{n2(q.cgstTotal)}</td></tr>
                  <tr><td>SGST</td><td className="num">{n2(q.sgstTotal)}</td></tr>
                </>
              ) : (
                <tr><td>IGST</td><td className="num">{n2(q.igstTotal)}</td></tr>
              )}
              <tr><td>Round off</td><td className="num">{n2(q.roundOff)}</td></tr>
              <tr style={{ fontWeight: 700, fontSize: 12 }}><td>Total after tax</td><td className="num">{n2(q.grandTotal)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28 }}>
        <div style={{ fontSize: 9 }}>
          This is a quotation, not a tax invoice. Prices and availability are confirmed when the order is placed.
        </div>
        <div style={{ textAlign: 'right' }}>For {q.shop.shopName}<br /><br />Authorised signatory</div>
      </div>
    </div>
  )
}