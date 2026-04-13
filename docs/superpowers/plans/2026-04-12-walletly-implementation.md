# Walletly Card Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BillSplit with Walletly — a card spending tracker with CSV import, automatic transaction categorization, and weekly Claude-powered digest recommendations.

**Architecture:** Rip-and-replace all BillSplit screens and Stripe logic while keeping the Expo + Firebase + Cloud Functions scaffold. Firebase Auth (modular SDK) replaces the no-auth model. Two callable Cloud Functions handle CSV parsing (`parseCSV`) and digest generation (`generateDigest`). A third scheduled function runs weekly. Responsive navigation renders a left sidebar on web and bottom tabs on mobile via a conditional Tab.Navigator renderer.

**Tech Stack:** Expo 54 (React Native + Web) · TypeScript · Firebase Auth · Firestore · Cloud Functions v2 (firebase-functions v5, Node 20) · `@anthropic-ai/sdk` · `csv-parse` · `@react-navigation/bottom-tabs`

---

## File Map

**Modified:**
- `App.tsx` — full rewrite: auth gate + NavigationContainer
- `firebase.ts` — add `auth` export
- `package.json` — remove `@stripe/stripe-react-native`, add `@react-navigation/bottom-tabs`, `expo-document-picker`
- `functions/package.json` — remove `stripe`, add `@anthropic-ai/sdk`, `csv-parse`, jest dev deps

**Replaced (full rewrite):**
- `src/types.ts` — Card, Transaction, Digest, Category types
- `src/navigation.ts` — RootTabParamList
- `functions/src/index.ts` — export parseCSV, generateDigest, weeklyDigestScheduler

**New — src:**
- `src/utils/week.ts` — getISOWeekId(), getWeekBounds()
- `src/hooks/useAuth.ts`
- `src/hooks/useCards.ts`
- `src/hooks/useTransactions.ts`
- `src/hooks/useDigest.ts`
- `src/navigation/AppNavigator.tsx` — Tab.Navigator with platform-conditional tabBar
- `src/components/Sidebar.tsx` — web-only left nav
- `src/screens/SignInScreen.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/TransactionsScreen.tsx`
- `src/screens/ImportScreen.tsx`
- `src/screens/DigestScreen.tsx`

**New — functions:**
- `functions/src/types.ts` — Category, TransactionData, DigestData (server-side)
- `functions/src/week.ts` — getISOWeekId(), getWeekBounds() (server-side copy)
- `functions/src/categoryKeywords.ts` — CATEGORY_KEYWORDS map + categorize()
- `functions/src/csvParser.ts` — pure CSV parsing logic (no Firebase deps, fully testable)
- `functions/src/parseCSV.ts` — Cloud Function wrapper calling csvParser
- `functions/src/generateDigest.ts` — Cloud Function: aggregates + Claude API + Firestore write
- `functions/src/weeklyDigestScheduler.ts` — scheduled function
- `functions/src/__tests__/categoryKeywords.test.ts`
- `functions/src/__tests__/csvParser.test.ts`
- `functions/src/__tests__/generateDigest.test.ts`
- `functions/jest.config.js`

**Deleted:**
- `src/screens/CreateBillScreen.tsx`
- `src/screens/BillDetailScreen.tsx`
- `src/screens/JoinBillScreen.tsx`
- `src/config.ts` (held Stripe publishable key)

---

### Task 1: Cleanup & dependencies

**Files:** `package.json`, `functions/package.json`, deleted screen files

- [ ] **Step 1: Delete BillSplit-specific files**

```bash
cd /c/Users/victo/OneDrive/Desktop/Proyects/Claude1/BillSplit
rm src/screens/CreateBillScreen.tsx src/screens/BillDetailScreen.tsx src/screens/JoinBillScreen.tsx src/config.ts
```

- [ ] **Step 2: Update mobile app package.json**

Remove `@stripe/stripe-react-native` from `dependencies`. Add:
```json
"@react-navigation/bottom-tabs": "^7.0.0"
```

Then run:
```bash
npm install
npx expo install expo-document-picker
```

Expected: `node_modules` updated, no errors.

- [ ] **Step 3: Update functions/package.json**

Remove `stripe` from `dependencies`. Add to `dependencies`:
```json
"@anthropic-ai/sdk": "^0.39.0",
"csv-parse": "^5.5.6"
```

Add to `devDependencies`:
```json
"@types/jest": "^29.5.0",
"jest": "^29.7.0",
"ts-jest": "^29.2.0"
```

Add to `scripts`:
```json
"test": "jest"
```

Then run:
```bash
cd functions && npm install
```

- [ ] **Step 4: Create functions/jest.config.js**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
}
```

- [ ] **Step 5: Commit**

```bash
cd ..
git add -A
git commit -m "chore: remove BillSplit/Stripe, add Walletly dependencies and jest config"
```

---

### Task 2: Types & utilities

**Files:** `src/types.ts`, `src/navigation.ts`, `src/utils/week.ts`, `functions/src/types.ts`, `functions/src/week.ts`

- [ ] **Step 1: Rewrite src/types.ts**

```typescript
export type Category = 'Dining' | 'Groceries' | 'Transport' | 'Subscriptions' | 'Other'

export interface Card {
  id: string
  name: string
  type: 'credit' | 'debit'
  bank: string
  lastFour: string
  color: string
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
  id: string          // ISO week e.g. "2026-W15"
  weekStart: number   // Unix ms
  weekEnd: number     // Unix ms
  generatedAt: number
  totalSpend: number
  byCategory: Partial<Record<Category, number>>
  summary: string
  recommendations: DigestRecommendation[]
}
```

- [ ] **Step 2: Rewrite src/navigation.ts**

```typescript
export type RootTabParamList = {
  Home: undefined
  Transactions: undefined
  Import: undefined
  Digest: undefined
}
```

- [ ] **Step 3: Create src/utils/week.ts**

```typescript
/** Returns ISO week ID string, e.g. "2026-W15" */
export function getISOWeekId(date: Date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/** Returns Monday 00:00:00 and Sunday 23:59:59 for a given ISO week ID */
export function getWeekBounds(weekId: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekId.split('-W')
  const year = Number(yearStr)
  const week = Number(weekStr)
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = (jan4.getDay() + 6) % 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + (week - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}
```

- [ ] **Step 4: Create functions/src/types.ts**

```typescript
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
```

- [ ] **Step 5: Create functions/src/week.ts**

Same content as `src/utils/week.ts` above — copy it verbatim. (Kept separate so the functions bundle has no dependency on the Expo app source.)

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/navigation.ts src/utils/ functions/src/types.ts functions/src/week.ts
git commit -m "feat: define Walletly types, navigation params, and week utilities"
```

---

### Task 3: Firebase Auth

**Files:** `firebase.ts`, `src/hooks/useAuth.ts`, `src/screens/SignInScreen.tsx`, `App.tsx`

- [ ] **Step 1: Update firebase.ts**

```typescript
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyAH7m3E41OlYl_rCzMUfvMVpAzLHQF1yag',
  authDomain: 'billsplit-53f84.firebaseapp.com',
  projectId: 'billsplit-53f84',
  storageBucket: 'billsplit-53f84.firebasestorage.app',
  messagingSenderId: '832801330835',
  appId: '1:832801330835:web:1cf432d97c6b542e48df66',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
```

- [ ] **Step 2: Create src/hooks/useAuth.ts**

```typescript
import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '../../firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
```

- [ ] **Step 3: Create src/screens/SignInScreen.tsx**

```typescript
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../../firebase'

export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmailAuth() {
    setLoading(true)
    setError(null)
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    if (Platform.OS !== 'web') return // Google sign-in popup only works on web
    setLoading(true)
    setError(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Walletly</Text>
      <Text style={styles.subtitle}>Your spending, your insights</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#555"
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#555"
        value={password} onChangeText={setPassword} secureTextEntry />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleEmailAuth} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> :
          <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
      </TouchableOpacity>
      {Platform.OS === 'web' && (
        <TouchableOpacity style={styles.googleButton} onPress={handleGoogle} disabled={loading}>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        <Text style={styles.toggle}>
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', justifyContent: 'center', padding: 24 },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#555', fontSize: 14, textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 15 },
  button: { backgroundColor: '#6c63ff', borderRadius: 10, padding: 15, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  googleButton: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 15, alignItems: 'center', marginBottom: 24 },
  googleText: { color: '#ccc', fontSize: 15 },
  toggle: { color: '#6c63ff', textAlign: 'center', fontSize: 13 },
  error: { color: '#ff6b6b', marginBottom: 12, textAlign: 'center', fontSize: 13 },
})
```

- [ ] **Step 4: Rewrite App.tsx**

```typescript
import 'react-native-get-random-values'
import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuth } from './src/hooks/useAuth'
import { SignInScreen } from './src/screens/SignInScreen'
import { AppNavigator } from './src/navigation/AppNavigator'

function RootNavigator() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#6c63ff" size="large" />
      </View>
    )
  }
  return user ? <AppNavigator /> : <SignInScreen />
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
```

Note: `AppNavigator` is created in Task 4. TypeScript will error on this import until then — that's expected.

- [ ] **Step 5: Commit**

```bash
git add firebase.ts src/hooks/useAuth.ts src/screens/SignInScreen.tsx App.tsx
git commit -m "feat: Firebase Auth, sign-in screen, and auth gate in App.tsx"
```

---

### Task 4: Navigation — sidebar (web) + bottom tabs (mobile)

**Files:** `src/components/Sidebar.tsx`, `src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Create src/components/Sidebar.tsx**

```typescript
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { signOut } from 'firebase/auth'
import { auth } from '../../firebase'
import { useAuth } from '../hooks/useAuth'

const TABS = [
  { name: 'Home', label: 'Home', icon: '🏠' },
  { name: 'Transactions', label: 'Transactions', icon: '💳' },
  { name: 'Import', label: 'Import', icon: '📥' },
  { name: 'Digest', label: 'Digest', icon: '✨' },
] as const

export function Sidebar({ state, navigation }: BottomTabBarProps) {
  const { user } = useAuth()
  const currentRoute = state.routes[state.index].name
  const initials = user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <View style={styles.sidebar}>
      <Text style={styles.brand}>Walletly</Text>
      {TABS.map((tab) => {
        const active = currentRoute === tab.name
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => navigation.navigate(tab.name)}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
      <View style={styles.spacer} />
      <TouchableOpacity style={styles.accountRow} onPress={() => signOut(auth)}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <Text style={styles.accountLabel}>Sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  sidebar: { width: 160, backgroundColor: '#111', borderRightWidth: 1, borderRightColor: '#1e1e2e', paddingHorizontal: 12, paddingVertical: 16 },
  brand: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 20, paddingHorizontal: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 4 },
  itemActive: { backgroundColor: '#1e1a3a' },
  icon: { fontSize: 16 },
  label: { color: '#555', fontSize: 12 },
  labelActive: { color: '#6c63ff', fontWeight: '600' },
  spacer: { flex: 1 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1e1e2e' },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#6c63ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  accountLabel: { color: '#555', fontSize: 11 },
})
```

- [ ] **Step 2: Create stub screens**

Create a minimal stub for each screen so navigation compiles. Create each of these:

`src/screens/HomeScreen.tsx`:
```typescript
import React from 'react'
import { View, Text } from 'react-native'
export function HomeScreen() {
  return <View style={{ flex: 1, backgroundColor: '#0f0f1a' }}><Text style={{ color: '#fff', padding: 16 }}>Home</Text></View>
}
```

Repeat the same stub pattern for `TransactionsScreen.tsx`, `ImportScreen.tsx`, `DigestScreen.tsx` — changing the text label to match.

- [ ] **Step 3: Create src/navigation/AppNavigator.tsx**

```typescript
import React from 'react'
import { Platform } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { RootTabParamList } from '../navigation'
import { Sidebar } from '../components/Sidebar'
import { HomeScreen } from '../screens/HomeScreen'
import { TransactionsScreen } from '../screens/TransactionsScreen'
import { ImportScreen } from '../screens/ImportScreen'
import { DigestScreen } from '../screens/DigestScreen'

const Tab = createBottomTabNavigator<RootTabParamList>()

const SCREENS = (
  <>
    <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
    <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
    <Tab.Screen name="Import" component={ImportScreen} options={{ title: 'Import' }} />
    <Tab.Screen name="Digest" component={DigestScreen} options={{ title: 'Digest' }} />
  </>
)

export function AppNavigator() {
  if (Platform.OS === 'web') {
    return (
      <Tab.Navigator
        tabBar={(props) => <Sidebar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {SCREENS}
      </Tab.Navigator>
    )
  }
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6c63ff',
        tabBarInactiveTintColor: '#555',
        tabBarStyle: { backgroundColor: '#111', borderTopColor: '#222' },
      }}
    >
      {SCREENS}
    </Tab.Navigator>
  )
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx expo start --web
```

Expected: App loads → sign-in screen. After signing in → 4-tab/sidebar layout with stub screens visible. No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/navigation/AppNavigator.tsx src/screens/
git commit -m "feat: responsive navigation — left sidebar on web, bottom tabs on mobile"
```

---

### Task 5: Firestore hooks

**Files:** `src/hooks/useCards.ts`, `src/hooks/useTransactions.ts`, `src/hooks/useDigest.ts`

- [ ] **Step 1: Create src/hooks/useCards.ts**

```typescript
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from './useAuth'
import { Card } from '../types'

export function useCards() {
  const { user } = useAuth()
  const [cards, setCards] = useState<Card[]>([])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'users', user.uid, 'cards'))
    return onSnapshot(q, (snap) => {
      setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Card)))
    })
  }, [user?.uid])

  return cards
}
```

- [ ] **Step 2: Create src/hooks/useTransactions.ts**

```typescript
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from './useAuth'
import { Transaction } from '../types'

interface Options {
  from?: number  // Unix ms — inclusive lower bound on date
  to?: number    // Unix ms — inclusive upper bound on date
}

export function useTransactions(options: Options = {}) {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    if (!user) return
    const ref = collection(db, 'users', user.uid, 'transactions')
    const constraints: any[] = [orderBy('date', 'desc')]
    if (options.from != null) constraints.push(where('date', '>=', options.from))
    if (options.to != null) constraints.push(where('date', '<=', options.to))
    return onSnapshot(query(ref, ...constraints), (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)))
    })
  }, [user?.uid, options.from, options.to])

  return transactions
}
```

- [ ] **Step 3: Create src/hooks/useDigest.ts**

```typescript
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from './useAuth'
import { Digest } from '../types'

export function useDigest(weekId: string) {
  const { user } = useAuth()
  const [digest, setDigest] = useState<Digest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    return onSnapshot(doc(db, 'users', user.uid, 'digests', weekId), (snap) => {
      setDigest(snap.exists() ? ({ id: snap.id, ...snap.data() } as Digest) : null)
      setLoading(false)
    })
  }, [user?.uid, weekId])

  return { digest, loading }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: useCards, useTransactions, useDigest Firestore hooks"
```

---

### Task 6: Home Screen

**Files:** `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Implement HomeScreen**

```typescript
import React from 'react'
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native'
import { useCards } from '../hooks/useCards'
import { useTransactions } from '../hooks/useTransactions'
import { useDigest } from '../hooks/useDigest'
import { getISOWeekId, getWeekBounds } from '../utils/week'
import { Category } from '../types'

const WEEK_ID = getISOWeekId()
const { start, end } = getWeekBounds(WEEK_ID)

const CATEGORY_COLORS: Record<Category, string> = {
  Dining: '#9c6fd6',
  Groceries: '#6fd66f',
  Transport: '#6faad6',
  Subscriptions: '#d6a96f',
  Other: '#888',
}

export function HomeScreen() {
  const cards = useCards()
  const transactions = useTransactions({ from: start.getTime(), to: end.getTime() })
  const { digest } = useDigest(WEEK_ID)

  const expenses = transactions.filter((t) => !t.excluded && t.amount < 0)
  const totalSpend = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const byCategory = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + Math.abs(t.amount)
    return acc
  }, {} as Partial<Record<Category, number>>)

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const topCategory = sorted[0]?.[0] ?? '—'
  const maxAmount = sorted[0]?.[1] ?? 1

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Card carousel */}
      <Text style={styles.label}>Your cards</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
        {cards.map((card) => (
          <View key={card.id} style={[styles.card, { backgroundColor: card.color }]}>
            <Text style={styles.cardType}>{card.type.toUpperCase()}</Text>
            <Text style={styles.cardName}>{card.name}</Text>
            <Text style={styles.cardLast}>•••• {card.lastFour}</Text>
          </View>
        ))}
        <View style={styles.addCard}><Text style={styles.addCardText}>+</Text></View>
      </ScrollView>

      {/* Stats */}
      <Text style={styles.label}>This week</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Spent</Text>
          <Text style={styles.statValue}>${totalSpend.toFixed(0)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Transactions</Text>
          <Text style={styles.statValue}>{transactions.length}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Top category</Text>
          <Text style={[styles.statValue, { fontSize: 16 }]}>{topCategory}</Text>
        </View>
      </View>

      {/* Category breakdown */}
      <Text style={styles.label}>By category</Text>
      <View style={styles.categoryCard}>
        {sorted.map(([cat, amount]) => (
          <View key={cat} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.barLabel}>{cat}</Text>
              <Text style={styles.barLabel}>${amount.toFixed(0)}</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, {
                width: `${(amount / maxAmount) * 100}%` as any,
                backgroundColor: CATEGORY_COLORS[cat as Category],
              }]} />
            </View>
          </View>
        ))}
        {sorted.length === 0 && <Text style={{ color: '#555', fontSize: 12 }}>No transactions this week</Text>}
      </View>

      {/* Digest preview */}
      {digest && (
        <View style={styles.digestCard}>
          <Text style={styles.digestHeading}>✨ Weekly Digest</Text>
          <Text style={styles.digestSummary} numberOfLines={3}>{digest.summary}</Text>
          <Text style={styles.digestLink}>See full digest →</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 16, paddingBottom: 32 },
  label: { color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 10 },
  card: { width: 180, borderRadius: 14, padding: 16, marginRight: 10, height: 100 },
  cardType: { color: 'rgba(255,255,255,0.7)', fontSize: 9, marginBottom: 8 },
  cardName: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  cardLast: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  addCard: { width: 70, height: 100, borderWidth: 2, borderColor: '#2a2a3a', borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addCardText: { color: '#333', fontSize: 22 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12 },
  statLabel: { color: '#888', fontSize: 10, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  categoryCard: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14, gap: 8 },
  barLabel: { color: '#ccc', fontSize: 12 },
  barBg: { backgroundColor: '#222', borderRadius: 4, height: 5 },
  barFill: { height: 5, borderRadius: 4 },
  digestCard: { marginTop: 4, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a', borderRadius: 10, padding: 14 },
  digestHeading: { color: '#6c63ff', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  digestSummary: { color: '#aaa', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  digestLink: { color: '#6c63ff', fontSize: 11 },
})
```

- [ ] **Step 2: Verify**

```bash
npx expo start --web
```

Expected: Home screen renders with empty state — no cards, no transactions, no digest. No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: Home screen — card carousel, weekly stats, category bars, digest preview"
```

---

### Task 7: categoryKeywords (TDD)

**Files:** `functions/src/categoryKeywords.ts`, `functions/src/__tests__/categoryKeywords.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/categoryKeywords.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd functions && npm test
```

Expected: FAIL — `Cannot find module '../categoryKeywords'`

- [ ] **Step 3: Implement functions/src/categoryKeywords.ts**

```typescript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd functions && npm test
```

Expected: 7 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add functions/src/categoryKeywords.ts functions/src/__tests__/categoryKeywords.test.ts functions/src/types.ts functions/jest.config.js
git commit -m "feat: transaction categorization with keyword matching (TDD)"
```

---

### Task 8: CSV parser (TDD)

**Files:** `functions/src/csvParser.ts`, `functions/src/__tests__/csvParser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/csvParser.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd functions && npm test -- csvParser
```

Expected: FAIL — `Cannot find module '../csvParser'`

- [ ] **Step 3: Implement functions/src/csvParser.ts**

```typescript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd functions && npm test -- csvParser
```

Expected: all csvParser tests pass.

- [ ] **Step 5: Run all tests**

```bash
cd functions && npm test
```

Expected: all tests pass (categoryKeywords + csvParser).

- [ ] **Step 6: Commit**

```bash
git add functions/src/csvParser.ts functions/src/__tests__/csvParser.test.ts
git commit -m "feat: CSV parser with auto-column detection and categorization (TDD)"
```

---

### Task 9: parseCSV Cloud Function

**Files:** `functions/src/parseCSV.ts`

- [ ] **Step 1: Create functions/src/parseCSV.ts**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import * as crypto from 'crypto'
import { parseCSVText } from './csvParser'

if (!admin.apps.length) admin.initializeApp()

export const parseCSV = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')

  const { csvText, cardId } = request.data as { csvText: string; cardId: string }
  if (!csvText || !cardId) throw new HttpsError('invalid-argument', 'csvText and cardId are required')

  const uid = request.auth.uid

  // Deduplicate by file hash
  const fileHash = crypto.createHash('sha256').update(csvText).digest('hex')
  const userRef = admin.firestore().collection('users').doc(uid)
  const userSnap = await userRef.get()
  const importHashes: string[] = userSnap.data()?.importHashes ?? []

  if (importHashes.includes(fileHash)) {
    throw new HttpsError('already-exists', 'This file has already been imported')
  }

  let transactions
  try {
    transactions = parseCSVText(csvText, cardId)
  } catch (e: any) {
    throw new HttpsError('invalid-argument', e.message ?? 'Could not parse CSV')
  }

  if (transactions.length === 0) {
    throw new HttpsError('invalid-argument', 'No valid transactions found in CSV')
  }

  return { transactions, fileHash }
})
```

- [ ] **Step 2: Commit**

```bash
git add functions/src/parseCSV.ts
git commit -m "feat: parseCSV Cloud Function — deduplicate, parse, categorize, return preview"
```

---

### Task 10: Import Screen

**Files:** `src/screens/ImportScreen.tsx`

- [ ] **Step 1: Install Firebase callable client utility**

Verify `firebase/functions` is available (it's part of the `firebase` package already installed). No extra install needed.

- [ ] **Step 2: Implement ImportScreen.tsx**

```typescript
import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, Alert,
} from 'react-native'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  collection, doc, writeBatch, updateDoc, arrayUnion, serverTimestamp,
} from 'firebase/firestore'
import * as DocumentPicker from 'expo-document-picker'
import { db } from '../../firebase'
import { useAuth } from '../hooks/useAuth'
import { useCards } from '../hooks/useCards'
import { Transaction } from '../types'
import { getISOWeekId } from '../utils/week'
import { v4 as uuid } from 'uuid'

type Step = 'pick' | 'preview' | 'importing'

interface ParsedResult {
  transactions: Omit<Transaction, 'id'>[]
  fileHash: string
}

const functions = getFunctions()
const parseCSVFn = httpsCallable<{ csvText: string; cardId: string }, ParsedResult>(functions, 'parseCSV')

export function ImportScreen() {
  const { user } = useAuth()
  const cards = useCards()
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('pick')
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFilePick() {
    if (!selectedCardId) { setError('Select a card first'); return }
    setError(null)

    let csvText: string
    if (Platform.OS === 'web') {
      csvText = await pickFileWeb()
    } else {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/csv' })
      if (result.canceled) return
      const response = await fetch(result.assets[0].uri)
      csvText = await response.text()
    }

    setLoading(true)
    try {
      const result = await parseCSVFn({ csvText, cardId: selectedCardId })
      setParsed(result.data)
      setStep('preview')
    } catch (e: any) {
      setError(e.message ?? 'Failed to parse CSV')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!parsed || !user) return
    setStep('importing')
    setLoading(true)
    try {
      const batch = writeBatch(db)
      for (const tx of parsed.transactions) {
        const ref = doc(collection(db, 'users', user.uid, 'transactions'), uuid())
        batch.set(ref, tx)
      }
      await batch.commit()
      await updateDoc(doc(db, 'users', user.uid), { importHashes: arrayUnion(parsed.fileHash) })

      // Trigger first digest if this is the first import
      const generateDigestFn = httpsCallable(getFunctions(), 'generateDigest')
      generateDigestFn({ uid: user.uid, weekId: getISOWeekId() }).catch(() => {})

      Alert.alert('Import complete', `${parsed.transactions.length} transactions imported.`)
      setParsed(null)
      setStep('pick')
    } catch (e: any) {
      setError(e.message ?? 'Import failed')
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'preview' && parsed) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Preview</Text>
        <Text style={styles.sub}>{parsed.transactions.length} transactions detected</Text>

        <View style={styles.tableHeader}>
          {['Date', 'Merchant', 'Amount', 'Category'].map((h) => (
            <Text key={h} style={[styles.col, styles.colHeader]}>{h}</Text>
          ))}
        </View>

        {parsed.transactions.slice(0, 20).map((tx, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.col}>{new Date(tx.date).toLocaleDateString()}</Text>
            <Text style={[styles.col, { flex: 2 }]} numberOfLines={1}>{tx.merchant}</Text>
            <Text style={[styles.col, { color: tx.amount < 0 ? '#ff6b6b' : '#6fd66f' }]}>
              {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
            </Text>
            <Text style={[styles.col, { color: '#6c63ff', fontSize: 10 }]}>{tx.category}</Text>
          </View>
        ))}

        {parsed.transactions.length > 20 && (
          <Text style={styles.sub}>…and {parsed.transactions.length - 20} more</Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleConfirm} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> :
            <Text style={styles.buttonText}>Import {parsed.transactions.length} transactions →</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => { setParsed(null); setStep('pick') }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Import transactions</Text>
      <Text style={styles.sub}>Export a CSV from your bank's website and upload it here</Text>

      <Text style={styles.label}>Which card?</Text>
      <View style={styles.chips}>
        {cards.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={[styles.chip, selectedCardId === card.id && styles.chipActive]}
            onPress={() => setSelectedCardId(card.id)}
          >
            <Text style={[styles.chipText, selectedCardId === card.id && styles.chipTextActive]}>
              {card.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.dropZone} onPress={handleFilePick} disabled={loading}>
        {loading ? <ActivityIndicator color="#6c63ff" /> : (
          <>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📄</Text>
            <Text style={styles.dropTitle}>{Platform.OS === 'web' ? 'Click to choose CSV' : 'Tap to choose CSV'}</Text>
            <Text style={styles.dropSub}>Chase, BofA, Wells Fargo, Citi, Amex and more</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

async function pickFileWeb(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,text/csv'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No file selected'))
      resolve(await file.text())
    }
    input.click()
  })
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 16, paddingBottom: 32 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#555', fontSize: 12, marginBottom: 16 },
  label: { color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a3a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { borderColor: '#6c63ff', backgroundColor: '#1e1a3a' },
  chipText: { color: '#555', fontSize: 13 },
  chipTextActive: { color: '#6c63ff', fontWeight: '600' },
  dropZone: { borderWidth: 2, borderColor: '#2a2a4a', borderStyle: 'dashed', borderRadius: 12, padding: 40, alignItems: 'center', backgroundColor: '#111' },
  dropTitle: { color: '#ccc', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  dropSub: { color: '#444', fontSize: 11 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#161628', padding: 8, borderRadius: 8, marginBottom: 4 },
  tableRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  col: { flex: 1, color: '#ccc', fontSize: 11 },
  colHeader: { color: '#555', fontSize: 10, textTransform: 'uppercase' },
  button: { backgroundColor: '#6c63ff', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  cancelButton: { padding: 12, alignItems: 'center' },
  cancelText: { color: '#555', fontSize: 13 },
  error: { color: '#ff6b6b', fontSize: 12, marginBottom: 12 },
})
```

- [ ] **Step 3: Verify**

```bash
npx expo start --web
```

Expected: Import screen shows card selector + drop zone. TypeScript reports no errors for this file.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ImportScreen.tsx
git commit -m "feat: Import screen — file picker, Cloud Function call, preview, confirm to Firestore"
```

---

### Task 11: Transactions Screen

**Files:** `src/screens/TransactionsScreen.tsx`

- [ ] **Step 1: Implement TransactionsScreen.tsx**

```typescript
import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../hooks/useAuth'
import { useTransactions } from '../hooks/useTransactions'
import { useCards } from '../hooks/useCards'
import { Category } from '../types'

const CATEGORIES: Category[] = ['Dining', 'Groceries', 'Transport', 'Subscriptions', 'Other']

export function TransactionsScreen() {
  const { user } = useAuth()
  const transactions = useTransactions()
  const cards = useCards()
  const [filterCard, setFilterCard] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<Category | null>(null)

  const filtered = transactions.filter((t) => {
    if (filterCard && t.cardId !== filterCard) return false
    if (filterCategory && t.category !== filterCategory) return false
    return true
  })

  async function toggleExcluded(txId: string, current: boolean) {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid, 'transactions', txId), { excluded: !current })
  }

  const cardName = (cardId: string) => cards.find((c) => c.id === cardId)?.name ?? cardId

  return (
    <View style={styles.container}>
      {/* Card filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity style={[styles.chip, !filterCard && styles.chipActive]} onPress={() => setFilterCard(null)}>
          <Text style={[styles.chipText, !filterCard && styles.chipTextActive]}>All cards</Text>
        </TouchableOpacity>
        {cards.map((c) => (
          <TouchableOpacity key={c.id} style={[styles.chip, filterCard === c.id && styles.chipActive]} onPress={() => setFilterCard(c.id)}>
            <Text style={[styles.chipText, filterCard === c.id && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity style={[styles.chip, !filterCategory && styles.chipActive]} onPress={() => setFilterCategory(null)}>
          <Text style={[styles.chipText, !filterCategory && styles.chipTextActive]}>All categories</Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity key={cat} style={[styles.chip, filterCategory === cat && styles.chipActive]} onPress={() => setFilterCategory(cat)}>
            <Text style={[styles.chipText, filterCategory === cat && styles.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView>
        {filtered.length === 0 && (
          <Text style={styles.empty}>No transactions yet. Import a CSV to get started.</Text>
        )}
        {filtered.map((tx) => (
          <TouchableOpacity key={tx.id} style={[styles.row, tx.excluded && styles.rowExcluded]} onPress={() => toggleExcluded(tx.id, tx.excluded)}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.merchant, tx.excluded && styles.textMuted]}>{tx.merchant}</Text>
              <Text style={styles.meta}>
                {new Date(tx.date).toLocaleDateString()} · {cardName(tx.cardId)} · {tx.category}
                {tx.excluded ? ' · excluded' : ''}
              </Text>
            </View>
            <Text style={[styles.amount, { color: tx.amount < 0 ? '#ff6b6b' : '#6fd66f' }, tx.excluded && styles.textMuted]}>
              {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row' },
  chip: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a3a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  chipActive: { borderColor: '#6c63ff', backgroundColor: '#1e1a3a' },
  chipText: { color: '#555', fontSize: 12 },
  chipTextActive: { color: '#6c63ff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  rowExcluded: { opacity: 0.45 },
  merchant: { color: '#ccc', fontSize: 13, fontWeight: '500', marginBottom: 2 },
  meta: { color: '#555', fontSize: 11 },
  amount: { fontSize: 14, fontWeight: '600' },
  textMuted: { color: '#444' },
  empty: { color: '#555', fontSize: 13, textAlign: 'center', padding: 32 },
})
```

- [ ] **Step 2: Verify**

```bash
npx expo start --web
```

Expected: Transactions screen renders with empty state and filter chips. Tapping a row should be wired up (actual toggle works once Firestore has data).

- [ ] **Step 3: Commit**

```bash
git add src/screens/TransactionsScreen.tsx
git commit -m "feat: Transactions screen — filter by card/category, tap to exclude"
```

---

### Task 12: generateDigest Cloud Function (TDD)

**Files:** `functions/src/generateDigest.ts`, `functions/src/__tests__/generateDigest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/__tests__/generateDigest.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd functions && npm test -- generateDigest
```

Expected: FAIL — `Cannot find module '../generateDigest'`

- [ ] **Step 3: Implement functions/src/generateDigest.ts**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import Anthropic from '@anthropic-ai/sdk'
import { TransactionData, DigestData, Category } from './types'
import { getWeekBounds } from './week'

if (!admin.apps.length) admin.initializeApp()

const claudeKey = defineSecret('CLAUDE_KEY')

// ─── Pure, testable helpers ───────────────────────────────────────────────────

export interface Aggregation {
  totalSpend: number
  byCategory: Partial<Record<Category, number>>
  count: number
}

export function aggregateTransactions(transactions: TransactionData[]): Aggregation {
  const expenses = transactions.filter((t) => !t.excluded && t.amount < 0)
  const byCategory: Partial<Record<Category, number>> = {}
  let totalSpend = 0

  for (const tx of expenses) {
    const abs = Math.abs(tx.amount)
    totalSpend += abs
    byCategory[tx.category] = (byCategory[tx.category] ?? 0) + abs
  }

  return { totalSpend, byCategory, count: expenses.length }
}

export function buildClaudePrompt(agg: Aggregation, weekId: string): string {
  const categoryLines = Object.entries(agg.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  - ${cat}: $${amt.toFixed(2)}`)
    .join('\n')

  return `Week: ${weekId}
Total spent: $${agg.totalSpend.toFixed(2)} across ${agg.count} transactions
By category:
${categoryLines}`
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const generateDigest = onCall({ secrets: [claudeKey] }, async (request) => {
  // Can be called by the client (first import) or by the scheduler (uid + weekId provided in data)
  const uid: string = request.data?.uid ?? request.auth?.uid
  const weekId: string = request.data?.weekId

  if (!uid || !weekId) throw new HttpsError('invalid-argument', 'uid and weekId are required')

  const { start, end } = getWeekBounds(weekId)
  const txSnap = await admin
    .firestore()
    .collection('users').doc(uid).collection('transactions')
    .where('date', '>=', start.getTime())
    .where('date', '<=', end.getTime())
    .get()

  const transactions = txSnap.docs.map((d) => d.data() as TransactionData)
  const agg = aggregateTransactions(transactions)

  if (agg.count === 0) return { skipped: true }

  const anthropic = new Anthropic({ apiKey: claudeKey.value() })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `You are a personal finance assistant. Respond with ONLY valid JSON — no markdown, no explanation — in this exact format:
{
  "summary": "2-3 sentence overview of the week",
  "recommendations": [
    {"title": "Short title", "detail": "1-2 sentence tip with specific numbers from the data"},
    {"title": "Short title", "detail": "..."}
  ]
}
Rules: be concise, realistic, non-judgmental. Include 2-3 recommendations. Acknowledge good habits too. Never invent merchants or amounts not in the data.`,
    messages: [{ role: 'user', content: buildClaudePrompt(agg, weekId) }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  let parsed: { summary: string; recommendations: { title: string; detail: string }[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new HttpsError('internal', 'Claude returned invalid JSON')
  }

  const digestData: DigestData = {
    weekStart: start.getTime(),
    weekEnd: end.getTime(),
    generatedAt: Date.now(),
    totalSpend: agg.totalSpend,
    byCategory: agg.byCategory,
    summary: parsed.summary,
    recommendations: parsed.recommendations,
  }

  await admin.firestore()
    .collection('users').doc(uid)
    .collection('digests').doc(weekId)
    .set(digestData)

  return { success: true }
})
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd functions && npm test -- generateDigest
```

Expected: 2 describe blocks, all tests pass.

- [ ] **Step 5: Run all tests**

```bash
cd functions && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add functions/src/generateDigest.ts functions/src/__tests__/generateDigest.test.ts
git commit -m "feat: generateDigest Cloud Function — aggregate, call Claude, store digest (TDD)"
```

---

### Task 13: Digest Screen

**Files:** `src/screens/DigestScreen.tsx`

- [ ] **Step 1: Implement DigestScreen.tsx**

```typescript
import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useDigest } from '../hooks/useDigest'
import { getISOWeekId } from '../utils/week'

function prevWeekId(weekId: string): string {
  const [y, w] = weekId.split('-W').map(Number)
  if (w === 1) return `${y - 1}-W52`
  return `${y}-W${String(w - 1).padStart(2, '0')}`
}

function nextWeekId(weekId: string): string {
  const [y, w] = weekId.split('-W').map(Number)
  if (w === 52) return `${y + 1}-W01`
  return `${y}-W${String(w + 1).padStart(2, '0')}`
}

const CURRENT_WEEK = getISOWeekId()

export function DigestScreen() {
  const [weekId, setWeekId] = useState(CURRENT_WEEK)
  const { digest, loading } = useDigest(weekId)
  const isCurrentWeek = weekId === CURRENT_WEEK

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekId(prevWeekId(weekId))}>
          <Text style={styles.navBtn}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.weekId}>{weekId}</Text>
        <TouchableOpacity onPress={() => setWeekId(nextWeekId(weekId))} disabled={isCurrentWeek}>
          <Text style={[styles.navBtn, isCurrentWeek && { opacity: 0.2 }]}>▶</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color="#6c63ff" style={{ marginTop: 40 }} />}

      {!loading && !digest && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No digest yet for {weekId}</Text>
          <Text style={styles.emptySubtext}>Digests are generated each Monday, or right after your first import.</Text>
        </View>
      )}

      {!loading && digest && (
        <>
          {/* AI Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>✨ AI Summary</Text>
            <Text style={styles.summaryText}>{digest.summary}</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Total spent</Text>
              <Text style={styles.statValue}>${digest.totalSpend.toFixed(0)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Transactions</Text>
              <Text style={styles.statValue}>{Object.values(digest.byCategory).reduce((a, b) => a + (b ?? 0), 0).toFixed(0)}</Text>
            </View>
          </View>

          {/* Recommendations */}
          <Text style={styles.sectionLabel}>Recommendations</Text>
          {digest.recommendations.map((rec, i) => (
            <View key={i} style={styles.recCard}>
              <Text style={styles.recTitle}>{rec.title}</Text>
              <Text style={styles.recDetail}>{rec.detail}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 16, paddingBottom: 32 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { color: '#6c63ff', fontSize: 18, padding: 8 },
  weekId: { color: '#fff', fontSize: 15, fontWeight: '600' },
  summaryCard: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a', borderRadius: 12, padding: 16, marginBottom: 14 },
  summaryLabel: { color: '#6c63ff', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  summaryText: { color: '#ccc', fontSize: 13, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12 },
  statLabel: { color: '#888', fontSize: 10, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sectionLabel: { color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  recCard: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14, marginBottom: 8 },
  recTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  recDetail: { color: '#888', fontSize: 12, lineHeight: 18 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#555', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#333', fontSize: 12, textAlign: 'center' },
})
```

- [ ] **Step 2: Verify**

```bash
npx expo start --web
```

Expected: Digest screen renders with week navigator and empty state. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/DigestScreen.tsx
git commit -m "feat: Digest screen — week navigation, AI summary, stats, recommendations"
```

---

### Task 14: weeklyDigestScheduler + functions/src/index.ts

**Files:** `functions/src/weeklyDigestScheduler.ts`, `functions/src/index.ts`

- [ ] **Step 1: Create functions/src/weeklyDigestScheduler.ts**

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'
import { generateDigest } from './generateDigest'
import { getISOWeekId } from './week'

if (!admin.apps.length) admin.initializeApp()

export const weeklyDigestScheduler = onSchedule(
  { schedule: '0 13 * * 1', timeZone: 'UTC' }, // Every Monday at 13:00 UTC
  async () => {
    const weekId = getISOWeekId(new Date())

    // Find all users who have transactions in the past week
    const usersSnap = await admin.firestore().collection('users').get()

    const tasks = usersSnap.docs.map(async (userDoc) => {
      const uid = userDoc.id
      const txSnap = await admin
        .firestore()
        .collection('users').doc(uid).collection('transactions')
        .limit(1)
        .get()

      if (txSnap.empty) return // skip users with no transactions

      // Call generateDigest's core logic directly (no HTTP overhead)
      // We import the function but call it via admin SDK to avoid circular deps
      // Use the callable approach by invoking via admin — simpler: just duplicate the call
      // Actually: re-use the exported Cloud Function's internal aggregation
      // For the scheduler, call generateDigest as a callable via REST or replicate logic.
      // Simplest approach: call via getFunctions() admin SDK is not available for calling callables.
      // Instead, extract the digest generation logic to a shared helper and call it directly.
      // See note below.
    })

    await Promise.allSettled(tasks)
  }
)
```

**Note:** The scheduler cannot call the `generateDigest` callable directly from server-side code. Refactor by extracting the digest generation logic into a shared `runDigest(uid, weekId)` helper in `generateDigest.ts`, then call it from both the callable and the scheduler.

- [ ] **Step 2: Extract runDigest helper in generateDigest.ts**

Add this export to `functions/src/generateDigest.ts` (before the Cloud Function export):

```typescript
// Exported so weeklyDigestScheduler can call it without HTTP overhead
export async function runDigest(uid: string, weekId: string, apiKey: string): Promise<void> {
  const { start, end } = getWeekBounds(weekId)
  const txSnap = await admin
    .firestore()
    .collection('users').doc(uid).collection('transactions')
    .where('date', '>=', start.getTime())
    .where('date', '<=', end.getTime())
    .get()

  const transactions = txSnap.docs.map((d) => d.data() as TransactionData)
  const agg = aggregateTransactions(transactions)
  if (agg.count === 0) return

  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `You are a personal finance assistant. Respond with ONLY valid JSON — no markdown, no explanation — in this exact format:
{
  "summary": "2-3 sentence overview of the week",
  "recommendations": [
    {"title": "Short title", "detail": "1-2 sentence tip with specific numbers from the data"}
  ]
}
Rules: be concise, realistic, non-judgmental. 2-3 recommendations. Acknowledge good habits too.`,
    messages: [{ role: 'user', content: buildClaudePrompt(agg, weekId) }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = JSON.parse(raw)
  const digestData: DigestData = {
    weekStart: start.getTime(),
    weekEnd: end.getTime(),
    generatedAt: Date.now(),
    totalSpend: agg.totalSpend,
    byCategory: agg.byCategory,
    summary: parsed.summary,
    recommendations: parsed.recommendations,
  }
  await admin.firestore()
    .collection('users').doc(uid)
    .collection('digests').doc(weekId)
    .set(digestData)
}
```

Also update the `generateDigest` callable to call `runDigest` internally (to avoid duplicating the logic):

```typescript
export const generateDigest = onCall({ secrets: [claudeKey] }, async (request) => {
  const uid: string = request.data?.uid ?? request.auth?.uid
  const weekId: string = request.data?.weekId
  if (!uid || !weekId) throw new HttpsError('invalid-argument', 'uid and weekId are required')
  await runDigest(uid, weekId, claudeKey.value())
  return { success: true }
})
```

- [ ] **Step 3: Update weeklyDigestScheduler.ts**

Replace the stub with:

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import { runDigest } from './generateDigest'
import { getISOWeekId } from './week'

if (!admin.apps.length) admin.initializeApp()

const claudeKey = defineSecret('CLAUDE_KEY')

export const weeklyDigestScheduler = onSchedule(
  { schedule: '0 13 * * 1', timeZone: 'UTC', secrets: [claudeKey] },
  async () => {
    const weekId = getISOWeekId(new Date())
    const usersSnap = await admin.firestore().collection('users').get()

    await Promise.allSettled(
      usersSnap.docs.map(async (userDoc) => {
        const uid = userDoc.id
        const txSnap = await admin
          .firestore()
          .collection('users').doc(uid).collection('transactions')
          .limit(1)
          .get()
        if (txSnap.empty) return
        await runDigest(uid, weekId, claudeKey.value())
      })
    )
  }
)
```

- [ ] **Step 4: Rewrite functions/src/index.ts**

```typescript
export { parseCSV } from './parseCSV'
export { generateDigest } from './generateDigest'
export { weeklyDigestScheduler } from './weeklyDigestScheduler'
```

- [ ] **Step 5: Build and run all tests**

```bash
cd functions && npm test
npm run build
```

Expected: all tests pass, TypeScript compiles to `lib/` with no errors.

- [ ] **Step 6: Type-check the mobile app**

```bash
cd .. && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add functions/src/
git commit -m "feat: weeklyDigestScheduler, runDigest helper, and functions index"
```

---

### Task 15: Deploy & configure

- [ ] **Step 1: Set the Claude API secret**

```bash
firebase functions:secrets:set CLAUDE_KEY
```

When prompted, paste your Anthropic API key (starts with `sk-ant-`).

Verify:
```bash
firebase functions:secrets:access CLAUDE_KEY
```

Expected: your key is printed.

- [ ] **Step 2: Enable Firebase Auth in the console**

Go to [Firebase Console](https://console.firebase.google.com) → your project → Authentication → Sign-in method → Enable **Email/Password** and **Google**.

- [ ] **Step 3: Add Firestore security rules**

In `firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

- [ ] **Step 4: Deploy Cloud Functions**

```bash
cd functions && npm run deploy
```

Expected: `parseCSV`, `generateDigest`, and `weeklyDigestScheduler` all deploy successfully.

- [ ] **Step 5: End-to-end smoke test**

1. Run `npx expo start --web` and open `http://localhost:8081`
2. Sign up with email/password
3. Go to Import → select a card (add one if needed — card creation UI is not yet built, add a card directly in Firestore console for now: `users/{uid}/cards/{cardId}` with `{ name, type, bank, lastFour, color }`)
4. Upload a CSV export from your bank
5. Verify preview shows parsed transactions with categories
6. Confirm import
7. Go to Transactions screen — verify transactions appear
8. Go to Digest screen — after a few seconds, a digest should appear (triggered by first import)

- [ ] **Step 6: Final commit**

```bash
git add firestore.rules
git commit -m "feat: Firestore security rules, deploy complete"
```

---

## Post-MVP: Add card management UI

The smoke test above requires adding a card via the Firestore console because card creation UI was not in scope for this plan. A follow-up plan should add:
- "Add card" sheet from the Home screen's `+` button
- Fields: card name, bank, last four digits, type (credit/debit), color picker
- Write to `users/{uid}/cards/{cardId}`
