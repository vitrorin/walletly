import { categorize } from '../categoryKeywords'

describe('categorize', () => {
  it('identifies food delivery as Dining', () => {
    expect(categorize('UBER EATS ORDER #123')).toBe('Dining')
    expect(categorize('DOORDASH*ORDER')).toBe('Dining')
    expect(categorize('CHIPOTLE 0421')).toBe('Dining')
  })

  it('identifies supermarkets as Groceries', () => {
    expect(categorize('WHOLEFDS MKT #123')).toBe('Groceries')
    expect(categorize('TRADER JOE S #042')).toBe('Groceries')
    expect(categorize('KROGER #0099')).toBe('Groceries')
  })

  it('identifies rideshare and gas as Transport', () => {
    expect(categorize('SHELL OIL 12345')).toBe('Transport')
    expect(categorize('LYFT *RIDE')).toBe('Transport')
    expect(categorize('MTA*METROCARD')).toBe('Transport')
  })

  it('identifies streaming services as Subscriptions', () => {
    expect(categorize('NETFLIX.COM')).toBe('Subscriptions')
    expect(categorize('SPOTIFY USA')).toBe('Subscriptions')
    expect(categorize('APPLE.COM/BILL')).toBe('Subscriptions')
  })

  it('returns Other for unrecognized merchants', () => {
    expect(categorize('XYZ HARDWARE CO')).toBe('Other')
    expect(categorize('RANDOM VENDOR 999')).toBe('Other')
  })

  it('is case-insensitive', () => {
    expect(categorize('Netflix Premium')).toBe('Subscriptions')
    expect(categorize('whole foods market')).toBe('Groceries')
  })

  it('prefers Dining over Transport for Uber Eats', () => {
    // "uber eats" contains "uber" (Transport) but Dining is checked first
    expect(categorize('UBER EATS *ORDER')).toBe('Dining')
  })
})
