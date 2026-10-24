export const fmtDate = (iso?: string | null) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
  'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function below1000(n: number): string {
  const parts: string[] = []
  if (n >= 100) { parts.push(ONES[Math.floor(n / 100)], 'Hundred'); n %= 100 }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)]); n %= 10 }
  if (n > 0) parts.push(ONES[n])
  return parts.join(' ')
}

// Indian system: crore, lakh, thousand
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  const crore = Math.floor(rupees / 10000000)
  const lakh = Math.floor((rupees % 10000000) / 100000)
  const thousand = Math.floor((rupees % 100000) / 1000)
  const rest = rupees % 1000
  const parts: string[] = []
  if (crore) parts.push(below1000(crore), 'Crore')
  if (lakh) parts.push(below1000(lakh), 'Lakh')
  if (thousand) parts.push(below1000(thousand), 'Thousand')
  if (rest) parts.push(below1000(rest))
  let words = parts.length ? parts.join(' ') : 'Zero'
  words = `Rupees ${words}`
  if (paise) words += ` and ${below1000(paise)} Paise`
  return `${words} Only`
}