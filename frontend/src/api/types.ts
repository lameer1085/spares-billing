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