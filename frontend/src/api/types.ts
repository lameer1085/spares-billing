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