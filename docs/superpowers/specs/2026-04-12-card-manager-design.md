# Card Manager App — Design Spec
_2026-04-12_

## Overview

Pivot the existing BillSplit Expo project into **Walletly** — a debit and credit card spending tracker with weekly AI-powered recommendations. Users import transactions via CSV, the app categorizes them automatically, and Claude generates a concise weekly digest with 2–3 realistic saving tips.

**Core principles:**
- Non-intrusive: no push notifications except a weekly digest; AI never sees raw merchant names, only category totals
- Privacy-first: data lives in the user's own Firebase project; Claude receives aggregated summaries only
- Low friction: CSV import works great on web; mobile is for viewing digests and summaries on the go

---

## Architecture

**Approach:** Rip-and-replace within the existing BillSplit project. Remove all Stripe code, bill/participant screens, and the code-based join flow. Keep the Expo + Firebase + Cloud Functions scaffolding.

**Stack:** Expo (React Native + Web) · TypeScript · Firebase Auth · Firebase Firestore · Firebase Cloud Functions · Claude API (Haiku)

**What changes:**
- All existing screens replaced
- Stripe dependency removed
- Firebase Auth added (replaces the no-auth model)
- New Firestore schema under `users/{uid}/`
- Three new Cloud Functions (see below)
- Expo Web enabled with responsive navigation

**Navigation:**
- **Web:** 160px left sidebar (Home, Transactions, Import, Digest + account avatar pinned to bottom)
- **Mobile:** bottom tab bar with the same 4 tabs

---

## Data Model

All data lives under `users/{uid}/` — fully isolated per user.

```
users/{uid}/
  importHashes: string[]       // SHA-256 hashes of imported CSV files — prevents duplicate imports

  cards/{cardId}
    name: string               // "Chase Sapphire"
    type: 'credit' | 'debit'
    bank: string
    lastFour: string           // display only
    color: string              // user-picked accent color

  transactions/{txId}
    cardId: string
    date: number               // Unix ms
    amount: number             // negative = expense, positive = refund/income
    merchant: string           // cleaned merchant name
    category: string           // "Dining" | "Groceries" | "Transport" | "Subscriptions" | "Other"
    rawDescription: string     // original CSV string, kept for debugging
    excluded: boolean          // user can flag one-off expenses to exclude from AI analysis

  digests/{weekId}             // weekId = ISO week string e.g. "2026-W15"
    weekStart: number          // Unix ms
    weekEnd: number            // Unix ms
    generatedAt: number        // Unix ms
    totalSpend: number
    byCategory: { [category: string]: number }
    summary: string            // Claude's 2–3 sentence overview
    recommendations: Array<{
      title: string
      detail: string
    }>
```

---

## Screens

### Home
- Card carousel (swipeable on mobile, horizontal row on web) — each card shows name, last four digits, type, and accent color. "+" card to add a new one.
- "This week" stats row: total spent, transaction count, top category
- Category breakdown: horizontal bar chart with amounts
- Digest preview card: truncated AI summary + "See full digest →" link

### Transactions
- List of all transactions across all cards, sorted by date descending
- Filter by card and/or category
- Tap a transaction to mark it as excluded (with a toggle)

### Import
3-step flow:
1. **Pick card + upload CSV** — card selector chips + drag-and-drop zone on web / document picker on mobile. Shows supported banks (Chase, BofA, Wells Fargo, Citi, Amex, and others).
2. **Preview & map columns** — `parseCSV` Cloud Function auto-detects date/description/amount columns and returns a preview of the first few rows with auto-assigned categories. User can verify before committing.
3. **Confirm** — "Import N transactions" button writes to Firestore; file hash stored to prevent re-import.

### Digest
- Week selector (◀ / ▶) to navigate between past digests
- Full AI summary paragraph
- Stats row: total spent, delta vs previous week, transaction count
- Recommendation cards (2–3): each has a title and a detail paragraph
- Positive habits are surfaced alongside tips (e.g. "Groceries are on track")

---

## Cloud Functions

### `parseCSV`
- Called by the client with the raw CSV text and the target `cardId`
- Detects column layout by matching common header names (date, description, amount variants)
- Categorizes each transaction by keyword matching on the raw description
- Returns a preview payload; client confirms before the function writes to Firestore
- Hashes the file content and checks `importHashes` to reject duplicates

**Category keyword map (initial):**
| Category | Keywords |
|---|---|
| Dining | uber eats, doordash, grubhub, mcdonald, starbucks, chipotle, restaurant, cafe |
| Groceries | wholefds, kroger, safeway, trader joe, aldi, publix, sprouts |
| Transport | uber, lyft, mta, metro, parking, toll, shell, exxon, chevron |
| Subscriptions | netflix, spotify, apple, google, amazon prime, hulu, disney |
| Other | (fallback) |

### `generateDigest`
- Accepts `uid` and `weekId`
- Fetches all non-excluded transactions for the week from Firestore
- Aggregates to totals by category (never sends raw merchant names to Claude)
- Calls Claude Haiku with the aggregated summary and a system prompt instructing it to be concise, realistic, and non-judgmental
- Stores the response (`summary` + `recommendations[]`) in `digests/{weekId}`
- Estimated cost: ~$0.005/user/week

**Claude prompt structure:**
```
System: You are a personal finance assistant. Be concise, realistic, and non-judgmental.
        Give 2-3 actionable recommendations based on the data. Acknowledge good habits too.
        Never fabricate specific merchants or amounts not provided.

User: Week of {weekStart} to {weekEnd}
      Total spent: ${total} across {count} transactions
      By category: {categoryBreakdown}
      vs last week: {delta}
```

### `weeklyDigestScheduler`
- Firebase scheduled function, runs every Monday at 13:00 UTC
- Queries all users with transactions in the previous week
- Calls `generateDigest` for each
- Does nothing if the user has no transactions that week

**First-time digest:** When a user completes their first CSV import, the client also calls `generateDigest` immediately for the current week so they see results right away rather than waiting until Monday.

---

## Auth

Firebase Auth with email/password and Google sign-in. No anonymous auth — all data is tied to a UID. Sign-in screen shown before any content.

---

## Key Implementation Notes

- **`react-native-get-random-values`** must remain the first import in `App.tsx` (polyfill for `uuid`)
- **Expo Web navigation:** use `Platform.OS === 'web'` to swap between sidebar and bottom tab bar
- **CSV upload on web:** use the browser's `<input type="file">` via Expo's document picker or a simple web file input
- **Stripe removed entirely:** uninstall `@stripe/stripe-react-native`, remove from `package.json` and Cloud Functions
- **Claude API key** stored in Firebase Functions config (`functions.config().claude.key`), never in client code
