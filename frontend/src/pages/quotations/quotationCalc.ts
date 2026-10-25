import { inr } from '../../api/types'

export interface QLine {
  key: string
  productId: number | null
  partNumber: string
  description: string
  hsnCode: string
  qty: string
  unit: string
  price: string       // per unit, excluding GST
  discount: string    // percent
  gst: string         // percent
  purchasePrice: number | null // owner only, used for the margin display
}

const paise = (n: number) => Math.round(n * 100)

export function calcLine(l: QLine, intra: boolean) {
  const qty = Number(l.qty) || 0
  const grossC = paise(Number(l.price) || 0) * qty
  const discC = Math.round((grossC * (Number(l.discount) || 0)) / 100)
  const taxableC = grossC - discC
  const taxC = Math.round((taxableC * (Number(l.gst) || 0)) / 100)
  const cgstC = intra ? Math.round(taxC / 2) : 0
  const sgstC = intra ? taxC - cgstC : 0
  const igstC = intra ? 0 : taxC
  const costC = l.purchasePrice == null ? null : paise(l.purchasePrice) * qty
  return { grossC, discC, taxableC, taxC, cgstC, sgstC, igstC, totalC: taxableC + taxC, costC }
}

export function calcTotals(lines: QLine[], intra: boolean) {
  let grossC = 0, discC = 0, taxableC = 0, cgstC = 0, sgstC = 0, igstC = 0
  let profitC = 0, costKnown = 0
  for (const l of lines) {
    const t = calcLine(l, intra)
    grossC += t.grossC; discC += t.discC; taxableC += t.taxableC
    cgstC += t.cgstC; sgstC += t.sgstC; igstC += t.igstC
    if (t.costC != null) { profitC += t.taxableC - t.costC; costKnown++ }
  }
  const rawC = taxableC + cgstC + sgstC + igstC
  const grandC = Math.round(rawC / 100) * 100
  return { grossC, discC, taxableC, cgstC, sgstC, igstC, roundOffC: grandC - rawC, grandC, profitC, costKnown }
}

export const rs = (cents: number) => inr(cents / 100)