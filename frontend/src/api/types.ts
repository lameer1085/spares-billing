export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface NameItem {
  id: number
  name: string
}

export interface Product {
  id: number
  partNumber: string
  name: string
  brandId: number | null
  brandName: string | null
  categoryId: number | null
  categoryName: string | null
  vehicleCompatibility: string | null
  hsnCode: string | null
  gstRate: number
  mrp: number
  purchasePrice: number | null // null for staff
  sellingPrice: number
  stockQty: number
  minStock: number
  rackLocation: string | null
  active: boolean
  lowStock: boolean
}

export const inr = (n: number | null | undefined) =>
  n == null ? '' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

export interface Customer {
  id: number
  name: string
  phone: string | null
  gstin: string | null
  address: string | null
  stateCode: string | null
  stateName: string | null
  creditLimit: number | null
  openingBalance: number | null
  active: boolean
}

export interface StateItem {
  code: string
  name: string
}

export interface LedgerEntry {
  date: string
  type: string
  reference: string | null
  description: string | null
  debit: number
  credit: number
  balance: number
}

export interface LedgerResponse {
  customerId: number
  customerName: string
  openingBalance: number
  totalDebit: number
  totalCredit: number
  closingBalance: number
  entries: LedgerEntry[]
}

export interface DuesResponse {
  totalOutstanding: number
  customers: { customerId: number; name: string; phone: string | null; balance: number; creditLimit: number | null }[]
}

export type PayMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK'

export interface BalanceResponse {
  customerId: number
  customerName: string
  balance: number
  creditLimit: number
  availableCredit: number
}

export interface InvoiceResult {
  id: number
  invoiceNo: string
  grandTotal: number
  paidAmount: number
  dueAmount: number
  roundOff: number
  taxableAmount: number
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
}

export interface InvoiceSummary {
  id: number
  invoiceNo: string
  invoiceDate: string
  customerId: number | null
  customerName: string
  grandTotal: number
  paidAmount: number
  dueAmount: number
  status: 'ACTIVE' | 'CANCELLED'
}

export interface InvoiceLine {
  description: string
  hsnCode: string | null
  quantity: number
  unitPrice: number
  discountAmount: number
  taxableAmount: number
  gstRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  lineTotal: number
  productId: number
  returnedQuantity: number
}

export interface InvoiceFull {
  id: number
  invoiceNo: string
  invoiceDate: string
  status: 'ACTIVE' | 'CANCELLED'
  cancelReason: string | null
  placeOfSupply: string | null
  placeOfSupplyName: string | null
  subtotal: number
  discountTotal: number
  taxableAmount: number
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
  roundOff: number
  grandTotal: number
  paidAmount: number
  dueAmount: number
  shop: ShopSettings
  customer: {
    id: number
    name: string
    phone: string | null
    gstin: string | null
    address: string | null
    stateCode: string | null
    stateName: string | null
  } | null
  items: InvoiceLine[]
  payments: { id: number; amount: number; method: string; reference: string | null; paymentDate: string; notes: string | null }[]
}

export interface PaymentRow {
  id: number
  customerId: number
  customerName: string
  invoiceId: number | null
  invoiceNo: string | null
  amount: number
  method: string
  reference: string | null
  paymentDate: string
  notes: string | null
  status: 'ACTIVE' | 'REVERSED'
  reverseReason: string | null
}

export interface PaymentResult {
  amount: number
  allocations: PaymentRow[]
  customerBalance: number
}

export interface CollectionSummary {
  from: string
  to: string
  byMethod: Record<string, number>
  refundsByMethod?: Record<string, number>
  total: number
}
export interface CreditNoteSummary {
  id: number
  creditNoteNo: string
  creditNoteDate: string
  invoiceId: number
  invoiceNo: string
  customerName: string | null
  grandTotal: number
  refundAmount: number
}

export interface CreditNoteFull {
  id: number
  creditNoteNo: string
  creditNoteDate: string
  invoiceId: number
  invoiceNo: string
  invoiceDate: string
  placeOfSupplyName: string | null
  taxableAmount: number
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
  roundOff: number
  grandTotal: number
  refundAmount: number
  refundMethod: string | null
  reason: string
  shop: InvoiceFull['shop']
  customer: InvoiceFull['customer']
  items: {
    description: string
    hsnCode: string | null
    quantity: number
    taxableAmount: number
    gstRate: number
    cgstAmount: number
    sgstAmount: number
    igstAmount: number
    lineTotal: number
    restocked: boolean
  }[]
}
export interface Supplier {
  id: number
  name: string
  phone: string | null
  gstin: string | null
  address: string | null
  stateCode: string | null
  stateName: string | null
  active: boolean
}

export interface PurchaseSummary {
  id: number
  supplierId: number
  supplierName: string
  supplierInvoiceNo: string | null
  purchaseDate: string
  totalAmount: number
  paidAmount: number
  dueAmount: number
  status: 'ACTIVE' | 'CANCELLED'
}

export interface PurchaseFull extends PurchaseSummary {
  notes: string | null
  cancelReason: string | null
  items: { productId: number; partNumber: string; name: string; quantity: number; unitCost: number; gstRate: number; lineTotal: number }[]
  payments: { id: number; amount: number; method: string; reference: string | null; paymentDate: string; notes: string | null }[]
}

export interface SupplierDue {
  supplierId: number
  supplierName: string
  due: number
}
export interface Dashboard {
  date: string
  invoiceCount: number
  salesTotal: number
  collectedToday: number
  customerDues: number
  supplierDues: number
  lowStockCount: number
}

export interface SalesRow {
  date: string
  invoices: number
  discount: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  roundOff: number
  grandTotal: number
  paid: number
  due: number
}

export interface SalesReport {
  from: string
  to: string
  totals: SalesRow
  returns: { creditNotes: number; taxable: number; cgst: number; sgst: number; igst: number; grandTotal: number; refunded: number }
  netSales: number
  cancelledCount: number
  cancelledAmount: number
  days: SalesRow[]
}

export interface RateRow { rate: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }
export interface TaxTotals { taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }
export interface HsnRow { hsn: string | null; rate: number; quantity: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }

export interface GstSummary {
  from: string
  to: string
  output: RateRow[]
  outputTotals: TaxTotals
  input: RateRow[]
  inputTotals: TaxTotals
  netTaxEstimate: number
  creditNotes: TaxTotals
  hsnSales: HsnRow[]
}

export interface StockReport {
  products: number
  units: number
  costValue: number
  sellingValue: number
  outOfStock: number
  lowStock: number
  categories: { category: string | null; products: number; units: number; costValue: number; sellingValue: number }[]
}

export interface TopProduct { productId: number; description: string; quantity: number; amount: number }

export interface ProfitReport {
  from: string
  to: string
  revenue: number
  cost: number
  profit: number
  marginPercent: number
  categories: { category: string | null; revenue: number; cost: number; profit: number; marginPercent: number }[]
  products: { productId: number; description: string; category: string | null; quantity: number; revenue: number; cost: number; profit: number; marginPercent: number }[]
}
export interface QuotationSummary {
  id: number
  quotationNo: string
  quotationDate: string
  validUntil: string
  buyerName: string
  grandTotal: number
  status: 'OPEN' | 'CANCELLED'
  revision: number
}

export interface QuotationFull {
  id: number
  quotationNo: string
  quotationDate: string
  validUntil: string
  revision: number
  status: 'OPEN' | 'CANCELLED'
  cancelReason: string | null
  customerId: number | null
  buyerName: string
  buyerAddress: string | null
  buyerGstin: string | null
  buyerPhone: string | null
  placeOfSupply: string
  placeOfSupplyName: string | null
  sameState: boolean
  subtotal: number
  discountTotal: number
  taxableAmount: number
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
  roundOff: number
  grandTotal: number
  terms: string | null
  notes: string | null
  createdAt: string
  shop: InvoiceFull['shop']
  items: {
    lineNo: number
    productId: number | null
    partNumber: string | null
    description: string
    hsnCode: string | null
    quantity: number
    unit: string
    unitPrice: number
    grossAmount: number
    discountPercent: number
    discountAmount: number
    taxableAmount: number
    gstRate: number
    cgstAmount: number
    sgstAmount: number
    igstAmount: number
    lineTotal: number
  }[]
}
export interface ShopSettings {
  shopName: string
  address: string | null
  phone: string | null
  gstin: string | null
  stateCode: string
  stateName: string | null
  invoicePrefix: string
  pincode: string | null
  bankAccountName: string | null
  bankName: string | null
  bankAccountNo: string | null
  bankIfsc: string | null
  upiId: string | null
}
export interface EwayDetails {
  invoiceId: number
  toPincode: string | null
  toPlace: string | null
  distanceKm: number | null
  transMode: number
  vehicleNo: string | null
  transporterName: string | null
  transporterId: string | null
  transDocNo: string | null
  transDocDate: string | null
  ewayBillNo: string | null
  ewayBillDate: string | null
}
export interface AppUser {
  id: number
  username: string
  fullName: string
  role: 'OWNER' | 'STAFF'
  active: boolean
  mustChangePassword: boolean
}

export interface Branding {
  appName: string
  hasFavicon: boolean
  version: number
}