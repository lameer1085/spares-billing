import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Customer, PayMethod, Product } from '../api/types'

export interface Line {
  product: Product
  qty: string
  discount: string
}
export type PayMode = 'FULL' | 'CREDIT' | 'PART'

export interface Draft {
  customer: Customer | null
  lines: Line[]
  payMode: PayMode
  partAmount: string
  method: PayMethod
}

export const EMPTY_DRAFT: Draft = {
  customer: null,
  lines: [],
  payMode: 'FULL',
  partAmount: '',
  method: 'CASH',
}

const keyFor = (u: string) => `spares_billing_draft_${u}`

function load(u: string): Draft {
  try {
    const raw = localStorage.getItem(keyFor(u))
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT
  } catch {
    return EMPTY_DRAFT
  }
}

interface Ctx {
  draft: Draft
  update: (fn: (d: Draft) => Draft) => void
  clear: () => void
}
const DraftContext = createContext<Ctx | null>(null)

function Inner({ username, children }: { username: string; children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => load(username))

  useEffect(() => {
    try {
      if (draft.lines.length === 0 && !draft.customer) localStorage.removeItem(keyFor(username))
      else localStorage.setItem(keyFor(username), JSON.stringify(draft))
    } catch {
      /* storage unavailable: the draft still lives in memory */
    }
  }, [draft, username])

  return (
    <DraftContext.Provider value={{ draft, update: (fn) => setDraft(fn), clear: () => setDraft(EMPTY_DRAFT) }}>
      {children}
    </DraftContext.Provider>
  )
}

// One draft per logged-in user. Changing user starts from that user's own draft.
export function DraftProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const name = user?.username ?? 'anon'
  return <Inner key={name} username={name}>{children}</Inner>
}

export function useDraft() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft must be used inside DraftProvider')
  return ctx
}