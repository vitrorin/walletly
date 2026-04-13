import { buildClaudePrompt, aggregateTransactions } from '../generateDigest'
import { TransactionData } from '../types'

const SAMPLE_TRANSACTIONS: TransactionData[] = [
  { cardId: 'c1', date: Date.now(), amount: -34.20, merchant: 'Uber Eats', category: 'Dining', rawDescription: 'UBER EATS', excluded: false },
  { cardId: 'c1', date: Date.now(), amount: -67.40, merchant: 'Whole Foods', category: 'Groceries', rawDescription: 'WHOLEFDS', excluded: false },
  { cardId: 'c1', date: Date.now(), amount: -15.99, merchant: 'Netflix', category: 'Subscriptions', rawDescription: 'NETFLIX.COM', excluded: false },
  { cardId: 'c1', date: Date.now(), amount: -34.20, merchant: 'Doordash', category: 'Dining', rawDescription: 'DOORDASH', excluded: false },
  { cardId: 'c1', date: Date.now(), amount: 2500.00, merchant: 'Paycheck', category: 'Other', rawDescription: 'SALARY', excluded: false },
  // excluded transaction — should not count
  { cardId: 'c1', date: Date.now(), amount: -500, merchant: 'Medical Bill', category: 'Other', rawDescription: 'HOSPITAL', excluded: true },
]

describe('aggregateTransactions', () => {
  it('sums expenses by category, ignoring excluded and income', () => {
    const agg = aggregateTransactions(SAMPLE_TRANSACTIONS)
    expect(agg.totalSpend).toBeCloseTo(151.79)
    expect(agg.byCategory['Dining']).toBeCloseTo(68.40)
    expect(agg.byCategory['Groceries']).toBeCloseTo(67.40)
    expect(agg.byCategory['Subscriptions']).toBeCloseTo(15.99)
    expect(agg.byCategory['Other']).toBeUndefined() // no non-excluded Other expenses
    expect(agg.count).toBe(4) // only 4 non-excluded expenses
  })
})

describe('buildClaudePrompt', () => {
  it('returns a string containing category totals but no merchant names', () => {
    const agg = aggregateTransactions(SAMPLE_TRANSACTIONS)
    const prompt = buildClaudePrompt(agg, '2026-W15')
    expect(prompt).toContain('Dining')
    expect(prompt).toContain('Groceries')
    expect(prompt).not.toContain('Uber Eats')
    expect(prompt).not.toContain('Whole Foods')
    expect(prompt).toContain('2026-W15')
  })
})
