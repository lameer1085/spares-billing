import type { InvoiceFull } from '../../api/types'

export interface EwayForm {
  toPincode: string; toPlace: string; distanceKm: string; transMode: string
  vehicleNo: string; transporterName: string; transporterId: string
  transDocNo: string; transDocDate: string; ewayBillNo: string; ewayBillDate: string
  fromPlace: string
}

// Version string of the portal's bulk-upload file. If the portal says the version is wrong, change it here.
const FILE_VERSION = '1.0.0621'
export const LIMIT_SAME_STATE = 100000
export const LIMIT_OTHER_STATE = 50000

const ddmmyyyy = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
const money = (n: number) => Math.round(n * 100) / 100
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

export function ewayNeeded(inv: InvoiceFull): boolean {
  if (inv.status !== 'ACTIVE') return false
  const same = !!inv.placeOfSupply && inv.placeOfSupply === inv.shop.stateCode
  return inv.grandTotal > (same ? LIMIT_SAME_STATE : LIMIT_OTHER_STATE)
}

export function buildEwayJson(inv: InvoiceFull, f: EwayForm): { json?: object; problems: string[] } {
  const problems: string[] = []
  const shop = inv.shop
  if (inv.status !== 'ACTIVE') problems.push('This bill is cancelled')
  if (!shop.gstin || shop.gstin.length !== 15) problems.push('Your GSTIN is missing (Settings)')
  if (!shop.pincode) problems.push('Your pincode is missing (Settings)')
  if (!shop.stateCode) problems.push('Your state is missing (Settings)')
  if (!inv.placeOfSupply) problems.push('This bill has no place of supply')
  if (!/^\d{6}$/.test(f.toPincode)) problems.push('Buyer pincode (6 digits) is required')
  if (!f.toPlace.trim()) problems.push('Buyer place is required')
  if (!f.fromPlace.trim()) problems.push('Your dispatch place is required')
  if (!inv.customer) problems.push('Walk-in bill: pick a customer on the bill, or the buyer will be sent as unregistered "URP" with the name "Cash customer"')
  inv.items.forEach((l, i) => {
    if (!/^\d{4,8}$/.test(l.hsnCode ?? '')) problems.push(`Line ${i + 1}: HSN code (4 to 8 digits) is missing`)
  })
  const hard = problems.filter((p) => !p.startsWith('Walk-in'))
  if (hard.length > 0) return { problems }

  const same = inv.placeOfSupply === shop.stateCode
  const toState = Number(inv.customer?.stateCode ?? inv.placeOfSupply)
  const addr = clean(inv.customer?.address ?? f.toPlace)
  const shopAddr = clean(shop.address ?? '')
  const cess = 0
  const otherValue = money(inv.roundOff)

  const bill: Record<string, unknown> = {
    userGstin: shop.gstin,
    supplyType: 'O',
    subSupplyType: 1,
    docType: 'INV',
    docNo: inv.invoiceNo,
    docDate: ddmmyyyy(inv.invoiceDate),
    transType: 1,
    fromGstin: shop.gstin,
    fromTrdName: clean(shop.shopName).slice(0, 100),
    fromAddr1: shopAddr.slice(0, 120) || shop.shopName.slice(0, 120),
    fromAddr2: shopAddr.slice(120, 240),
    fromPlace: clean(f.fromPlace).slice(0, 50),
    fromPincode: Number(shop.pincode),
    actFromStateCode: Number(shop.stateCode),
    fromStateCode: Number(shop.stateCode),
    toGstin: inv.customer?.gstin || 'URP',
    toTrdName: clean(inv.customer?.name ?? 'Cash customer').slice(0, 100),
    toAddr1: addr.slice(0, 120),
    toAddr2: addr.slice(120, 240),
    toPlace: clean(f.toPlace).slice(0, 50),
    toPincode: Number(f.toPincode),
    actToStateCode: toState,
    fromStateCodeNote: undefined,
    toStateCode: toState,
    totalValue: money(inv.taxableAmount),
    cgstValue: money(inv.cgstTotal),
    sgstValue: money(inv.sgstTotal),
    igstValue: money(inv.igstTotal),
    cessValue: cess,
    cessNonAdvolValue: 0,
    otherValue,
    totInvValue: money(inv.grandTotal),
    transMode: Number(f.transMode),
    transDistance: Number(f.distanceKm) || 0,
    mainHsnCode: Number(inv.items[0].hsnCode),
    itemList: inv.items.map((l, i) => ({
      itemNo: i + 1,
      productName: clean(l.description).slice(0, 100),
      productDesc: clean(l.description).slice(0, 100),
      hsnCode: Number(l.hsnCode),
      quantity: l.quantity,
      qtyUnit: 'NOS',
      taxableAmount: money(l.taxableAmount),
      sgstRate: same ? l.gstRate / 2 : 0,
      cgstRate: same ? l.gstRate / 2 : 0,
      igstRate: same ? 0 : l.gstRate,
      cessRate: 0,
      cessNonadvol: 0,
    })),
  }
  delete bill.fromStateCodeNote

  if (f.transporterId.trim()) bill.transporterId = f.transporterId.trim().toUpperCase()
  if (f.transporterName.trim()) bill.transporterName = clean(f.transporterName)
  if (f.transDocNo.trim()) bill.transDocNo = f.transDocNo.trim()
  if (f.transDocDate) bill.transDocDate = ddmmyyyy(f.transDocDate)
  if (f.vehicleNo.trim()) {
    bill.vehicleNo = f.vehicleNo.replace(/\s+/g, '').toUpperCase()
    bill.vehicleType = 'R'
  }
  return { json: { version: FILE_VERSION, billLists: [bill] }, problems }
}