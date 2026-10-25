// All dates are in India time, as YYYY-MM-DD
const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
export const todayIST = () => fmt(new Date())
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export interface Preset { label: string; from: string; to: string }

export function presets(): Preset[] {
  const today = todayIST()
  const [y, m] = today.split('-').map(Number)
  const lm = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
  const lastDayLastMonth = new Date(Date.UTC(y, m - 1, 0)).getUTCDate()
  const fyStartYear = m >= 4 ? y : y - 1
  return [
    { label: 'Today', from: today, to: today },
    { label: 'This month', from: iso(y, m, 1), to: today },
    { label: 'Last month', from: iso(lm.y, lm.m, 1), to: iso(lm.y, lm.m, lastDayLastMonth) },
    { label: 'This financial year', from: iso(fyStartYear, 4, 1), to: today },
  ]
}