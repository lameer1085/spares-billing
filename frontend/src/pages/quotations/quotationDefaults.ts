export const DEFAULT_TERMS = `1. Prices are exclusive of GST. GST is charged extra as shown.
2. This quotation is valid until the date shown above.
3. Payment: 100% advance, or as agreed in writing.
4. Delivery: within ___ days of the order, subject to stock availability.
5. Goods once sold will not be taken back or exchanged.
6. Subject to Kadayanallur jurisdiction.`

const KEY = 'spares_quotation_terms'

export function loadDefaultTerms(): string {
  try { return localStorage.getItem(KEY) ?? DEFAULT_TERMS } catch { return DEFAULT_TERMS }
}
export function saveDefaultTerms(text: string) {
  try { localStorage.setItem(KEY, text) } catch { /* ignore */ }
}