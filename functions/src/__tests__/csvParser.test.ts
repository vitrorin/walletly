import { parseCSVText, detectColumns } from '../csvParser'

const CHASE_CSV = `Transaction Date,Description,Amount
04/12/2026,STARBUCKS #0421,-4.75
04/11/2026,WHOLEFDS MKT 123,-67.40
04/10/2026,NETFLIX.COM,-15.99
04/09/2026,PAYCHECK DIRECT DEP,2500.00`

const BOFA_CSV = `Date,Description,Debit,Credit
04/12/2026,DOORDASH ORDER,34.20,
04/11/2026,SALARY DEPOSIT,,3000.00`

describe('detectColumns', () => {
  it('detects standard Chase columns', () => {
    const headers = ['Transaction Date', 'Description', 'Amount']
    const cols = detectColumns(headers)
    expect(cols.dateIdx).toBe(0)
    expect(cols.descIdx).toBe(1)
    expect(cols.amountIdx).toBe(2)
    expect(cols.debitIdx).toBe(-1)
  })

  it('detects BofA separate debit/credit columns', () => {
    const headers = ['Date', 'Description', 'Debit', 'Credit']
    const cols = detectColumns(headers)
    expect(cols.dateIdx).toBe(0)
    expect(cols.descIdx).toBe(1)
    expect(cols.debitIdx).toBe(2)
    expect(cols.creditIdx).toBe(3)
  })

  it('throws on unrecognizable headers', () => {
    expect(() => detectColumns(['Col1', 'Col2', 'Col3'])).toThrow()
  })
})

describe('parseCSVText', () => {
  it('parses Chase CSV and categorizes transactions', () => {
    const txs = parseCSVText(CHASE_CSV, 'card1')
    expect(txs).toHaveLength(4)
    expect(txs[0].category).toBe('Dining')      // Starbucks
    expect(txs[1].category).toBe('Groceries')   // Wholefds
    expect(txs[2].category).toBe('Subscriptions') // Netflix
    expect(txs[0].amount).toBe(-4.75)
    expect(txs[3].amount).toBe(2500)             // income is positive
    expect(txs[0].cardId).toBe('card1')
    expect(txs[0].excluded).toBe(false)
  })

  it('parses BofA CSV with debit/credit columns', () => {
    const txs = parseCSVText(BOFA_CSV, 'card2')
    expect(txs).toHaveLength(2)
    expect(txs[0].amount).toBeLessThan(0)   // debit → negative
    expect(txs[1].amount).toBeGreaterThan(0) // credit → positive
  })

  it('skips rows with unparseable dates or amounts', () => {
    const bad = `Date,Description,Amount\nnot-a-date,COFFEE,-5.00`
    const txs = parseCSVText(bad, 'c1')
    expect(txs).toHaveLength(0) // NaN date filtered out
  })

  it('cleans merchant name from raw description', () => {
    const csv = `Transaction Date,Description,Amount\n04/12/2026,UBER EATS *ORDER 04/12,-34.20`
    const txs = parseCSVText(csv, 'c1')
    expect(txs[0].merchant).toBe('UBER EATS *ORDER')
    expect(txs[0].rawDescription).toBe('UBER EATS *ORDER 04/12')
  })
})
