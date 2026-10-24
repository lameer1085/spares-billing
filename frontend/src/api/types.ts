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
  shop: {
    shopName: string
    address: string | null
    phone: string | null
    gstin: string | null
    stateCode: string | null
    stateName: string | null
    invoicePrefix: string
  }
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