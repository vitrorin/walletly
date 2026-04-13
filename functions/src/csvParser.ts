import { parse } from 'csv-parse/sync'
import { categorize } from './categoryKeywords'
import { Category, TransactionData } from './types'

const DATE_HEADERS = ['transaction date', 'date', 'posted date', 'trans. date', 'posting date']
const DESC_HEADERS = ['description', 'merchant name', 'transaction description', 'name', 'payee', 'memo']
const AMOUNT_HEADERS = ['amount', 'transaction amount']
const DEBIT_HEADERS = ['debit', 'debit amount', 'withdrawal']
const CREDIT_HEADERS = ['credit', 'credit amount', 'deposit']

function findColumn(headers: string[], patterns: string[]): number {
  return headers.findIndex((h) => patterns.some((p) => h.toLowerCase().trim() === p))
}

export interface ColumnMap {
  dateIdx: number
  descIdx: number
  amountIdx: number
  debitIdx: number
  creditIdx: number
}

export function detectColumns(headers: string[]): ColumnMap {
  const dateIdx = findColumn(headers, DATE_HEADERS)
  const descIdx = findColumn(headers, DESC_HEADERS)
  const amountIdx = findColumn(headers, AMOUNT_HEADERS)
  const debitIdx = findColumn(headers, DEBIT_HEADERS)
  const creditIdx = findColumn(headers, CREDIT_HEADERS)

  const hasAmount = amountIdx !== -1
  const hasSplitCols = debitIdx !== -1 && creditIdx !== -1

  if (dateIdx === -1 || descIdx === -1 || (!hasAmount && !hasSplitCols)) {
    throw new Error('Could not detect required CSV columns (date, description, amount)')
  }

  return { dateIdx, descIdx, amountIdx, debitIdx, creditIdx }
}

function parseAmount(cols: ColumnMap, row: string[]): number {
  if (cols.amountIdx !== -1) {
    return parseFloat(row[cols.amountIdx]?.replace(/[$,\s]/g, '') ?? '') || NaN
  }
  const debit = parseFloat(row[cols.debitIdx]?.replace(/[$,\s]/g, '') ?? '') || 0
  const credit = parseFloat(row[cols.creditIdx]?.replace(/[$,\s]/g, '') ?? '') || 0
  return credit > 0 ? credit : -debit
}

function cleanMerchant(desc: string): string {
  return desc.replace(/\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?$/, '').replace(/\s{2,}/g, ' ').trim()
}

export function parseCSVText(csvText: string, cardId: string): TransactionData[] {
  const rows: string[][] = parse(csvText, { relax_column_count: true, skip_empty_lines: true })
  if (rows.length < 2) return []

  const cols = detectColumns(rows[0])

  return rows.slice(1)
    .map((row): TransactionData | null => {
      const rawDescription = row[cols.descIdx] ?? ''
      const date = new Date(row[cols.dateIdx] ?? '').getTime()
      const amount = parseAmount(cols, row)
      if (isNaN(date) || isNaN(amount)) return null
      return {
        cardId,
        date,
        amount,
        merchant: cleanMerchant(rawDescription),
        category: categorize(rawDescription) as Category,
        rawDescription,
        excluded: false,
      }
    })
    .filter((t): t is TransactionData => t !== null)
}
