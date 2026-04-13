import { Category } from './types'

export const CATEGORY_KEYWORDS: Record<Exclude<Category, 'Other'>, string[]> = {
  Dining: [
    'uber eats', 'doordash', 'grubhub', 'mcdonald', 'starbucks', 'chipotle',
    'restaurant', 'cafe', 'pizza', 'sushi', 'diner', 'eatery', 'bbq', 'grill',
    'taco', 'burrito', 'sandwich', 'panera', 'subway', 'chick-fil',
  ],
  Groceries: [
    'wholefds', 'whole foods', 'kroger', 'safeway', 'trader joe', 'aldi',
    'publix', 'sprouts', 'costco', 'food lion', 'wegmans', 'heb', 'raleys',
  ],
  Transport: [
    'uber', 'lyft', 'mta', 'metro', 'parking', 'toll', 'shell', 'exxon',
    'chevron', 'bp gas', 'sunoco', 'amtrak', 'greyhound', 'delta air', 'southwest air',
  ],
  Subscriptions: [
    'netflix', 'spotify', 'apple.com', 'google one', 'amazon prime', 'hulu',
    'disney', 'youtube premium', 'icloud', 'dropbox', 'adobe', 'microsoft 365',
  ],
}

export function categorize(description: string): Category {
  const lower = description.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      return category as Category
    }
  }
  return 'Other'
}
