export type Category = 'Dining' | 'Groceries' | 'Transport' | 'Subscriptions' | 'Other'

export interface Card {
  id: string
  name: string
  type: 'credit' | 'debit'
  bank: string
  lastFour: string
  color: string
  createdAt?: import('firebase/firestore').Timestamp
}

export interface Transaction {
  id: string
  cardId: string
  date: number        // Unix ms
  amount: number      // negative = expense, positive = refund/income
  merchant: string
  category: Category
  rawDescription: string
  excluded: boolean
}

export interface DigestRecommendation {
  title: string
  detail: string
}

export interface Digest {
  weekId: string      // ISO week e.g. "2026-W15" — matches the Firestore document key
  weekStart: number   // Unix ms
  weekEnd: number     // Unix ms
  generatedAt: number
  totalSpend: number  // always positive — magnitude of expenses (excludes income/refunds)
  byCategory: Partial<Record<Category, number>>
  summary: string
  recommendations: DigestRecommendation[]
}
