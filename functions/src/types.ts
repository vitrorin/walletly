export type Category = 'Dining' | 'Groceries' | 'Transport' | 'Subscriptions' | 'Other'

export interface TransactionData {
  cardId: string
  date: number
  amount: number
  merchant: string
  category: Category
  rawDescription: string
  excluded: boolean
}

export interface DigestRecommendation {
  title: string
  detail: string
}

export interface DigestData {
  weekStart: number
  weekEnd: number
  generatedAt: number
  totalSpend: number
  byCategory: Partial<Record<Category, number>>
  summary: string
  recommendations: DigestRecommendation[]
}
