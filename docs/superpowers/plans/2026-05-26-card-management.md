# Card Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app UI to create and delete cards from the HomeScreen carousel without touching the Firestore console.

**Architecture:** A new `CardSheet` component wraps React Native's `Modal` with a `Animated.spring` slide-up and holds the full add-card form. HomeScreen wires the existing `+` button to open it and adds `onLongPress` → `Alert.alert` for deletion. No new hooks, no new screens, no schema changes.

**Tech Stack:** Expo 54 · React Native · TypeScript · Firebase Firestore (modular SDK) · `Animated` from `react-native`

---

## File Map

| File | Action |
|---|---|
| `src/components/CardSheet.tsx` | Create — bottom sheet modal with add-card form |
| `src/screens/HomeScreen.tsx` | Modify — wire `+` button, card long-press delete |

---

### Task 1: CardSheet component

**Files:**
- Create: `src/components/CardSheet.tsx`

- [ ] **Step 1: Create `src/components/CardSheet.tsx`**

```tsx
import React, { useState, useRef, useEffect } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, Pressable, ActivityIndicator, Alert,
} from 'react-native'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../hooks/useAuth'

const COLORS = [
  '#6c63ff', '#e91e8c', '#00b4d8', '#06d6a0',
  '#f77f00', '#ef233c', '#3a86ff', '#8338ec',
]

interface Props {
  visible: boolean
  onClose: () => void
}

export function CardSheet({ visible, onClose }: Props) {
  const { user } = useAuth()
  const slideAnim = useRef(new Animated.Value(300)).current

  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [type, setType] = useState<'credit' | 'debit'>('credit')
  const [color, setColor] = useState('#6c63ff')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start()
    }
  }, [visible])

  function resetForm() {
    setName('')
    setBank('')
    setLastFour('')
    setType('credit')
    setColor('#6c63ff')
    setErrors({})
    slideAnim.setValue(300)
  }

  function close() {
    Animated.spring(slideAnim, { toValue: 300, useNativeDriver: true }).start(() => {
      onClose()
      resetForm()
    })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'El nombre es requerido'
    if (!bank.trim()) e.bank = 'El banco es requerido'
    if (!/^\d{4}$/.test(lastFour)) e.lastFour = 'Ingresa exactamente 4 dígitos'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate() || !user) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'users', user.uid, 'cards'), {
        name: name.trim(),
        bank: bank.trim(),
        lastFour,
        type,
        color,
      })
      close()
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo guardar la tarjeta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Nueva tarjeta</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre (ej. Visa Principal)"
          placeholderTextColor="#555"
          value={name}
          onChangeText={setName}
        />
        {errors.name && <Text style={styles.error}>{errors.name}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Banco (ej. BBVA)"
          placeholderTextColor="#555"
          value={bank}
          onChangeText={setBank}
        />
        {errors.bank && <Text style={styles.error}>{errors.bank}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Últimos 4 dígitos"
          placeholderTextColor="#555"
          value={lastFour}
          onChangeText={setLastFour}
          keyboardType="numeric"
          maxLength={4}
        />
        {errors.lastFour && <Text style={styles.error}>{errors.lastFour}</Text>}

        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'credit' && styles.typeBtnActive]}
            onPress={() => setType('credit')}
          >
            <Text style={[styles.typeBtnText, type === 'credit' && styles.typeBtnTextActive]}>
              Crédito
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'debit' && styles.typeBtnActive]}
            onPress={() => setType('debit')}
          >
            <Text style={[styles.typeBtnText, type === 'debit' && styles.typeBtnTextActive]}>
              Débito
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Color</Text>
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        <View style={[styles.preview, { backgroundColor: color }]}>
          <Text style={styles.previewType}>{type === 'credit' ? 'CRÉDITO' : 'DÉBITO'}</Text>
          <Text style={styles.previewName}>{name || 'Nombre de tarjeta'}</Text>
          <Text style={styles.previewLast}>•••• {lastFour || '0000'}</Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Guardar tarjeta</Text>}
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  input: {
    backgroundColor: '#0f0f1a',
    color: '#fff',
    borderRadius: 10,
    padding: 13,
    marginBottom: 4,
    fontSize: 14,
  },
  error: { color: '#ff6b6b', fontSize: 11, marginBottom: 8, marginLeft: 4 },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  typeBtnActive: { borderColor: '#6c63ff', backgroundColor: '#1e1a3a' },
  typeBtnText: { color: '#555', fontSize: 13, fontWeight: '600' },
  typeBtnTextActive: { color: '#6c63ff' },
  label: {
    color: '#888',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  swatchActive: {
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#fff',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  preview: { borderRadius: 12, padding: 14, marginBottom: 16 },
  previewType: { color: 'rgba(255,255,255,0.6)', fontSize: 8, marginBottom: 6 },
  previewName: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  previewLast: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  saveBtn: {
    backgroundColor: '#6c63ff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CardSheet.tsx
git commit -m "feat: CardSheet bottom sheet — add card form with color palette"
```

---

### Task 2: Wire HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Replace the full `src/screens/HomeScreen.tsx`**

Replace the entire file with the following (changes vs. current: added `Alert`, `deleteDoc`, `doc`, `useAuth` imports; added `sheetOpen` state; cards changed from `View` to `TouchableOpacity` with `onLongPress`; `+` button changed from `View` to `TouchableOpacity`; `CardSheet` rendered at bottom):

```tsx
import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../hooks/useAuth'
import { useCards } from '../hooks/useCards'
import { useTransactions } from '../hooks/useTransactions'
import { useDigest } from '../hooks/useDigest'
import { CardSheet } from '../components/CardSheet'
import { getISOWeekId, getWeekBounds } from '../utils/week'
import { Card, Category } from '../types'
import { RootTabParamList } from '../navigation'

const CATEGORY_COLORS: Record<Category, string> = {
  Dining: '#9c6fd6',
  Groceries: '#6fd66f',
  Transport: '#6faad6',
  Subscriptions: '#d6a96f',
  Other: '#888',
}

export function HomeScreen() {
  const WEEK_ID = getISOWeekId()
  const { start, end } = getWeekBounds(WEEK_ID)
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>()
  const { user } = useAuth()
  const { cards } = useCards()
  const { transactions } = useTransactions()
  const { digest } = useDigest(WEEK_ID)
  const [sheetOpen, setSheetOpen] = useState(false)

  const weekStart = start.getTime()
  const weekEnd = end.getTime()
  const weekTransactions = transactions.filter(
    (t) => t.date >= weekStart && t.date <= weekEnd
  )

  const expenses = weekTransactions.filter((t) => !t.excluded && t.amount < 0)
  const totalSpend = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const byCategory = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + Math.abs(t.amount)
    return acc
  }, {} as Partial<Record<Category, number>>)

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const topCategory = sorted[0]?.[0] ?? '—'
  const maxAmount = sorted[0]?.[1] ?? 1

  function handleDeleteCard(card: Card) {
    if (!user) return
    Alert.alert(
      card.name,
      '¿Eliminar esta tarjeta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteDoc(doc(db, 'users', user.uid, 'cards', card.id)),
        },
      ]
    )
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Card carousel */}
        <Text style={styles.label}>Your cards</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[styles.card, { backgroundColor: card.color }]}
              onLongPress={() => handleDeleteCard(card)}
              delayLongPress={400}
            >
              <Text style={styles.cardType}>{card.type.toUpperCase()}</Text>
              <Text style={styles.cardName}>{card.name}</Text>
              <Text style={styles.cardLast}>•••• {card.lastFour}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addCard} onPress={() => setSheetOpen(true)}>
            <Text style={styles.addCardText}>+</Text>
          </TouchableOpacity>
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
            <Text style={styles.statValue}>{weekTransactions.length}</Text>
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
          {sorted.length === 0 && (
            <Text style={{ color: '#555', fontSize: 12 }}>No transactions this week</Text>
          )}
        </View>

        {/* Digest preview */}
        {digest && (
          <View style={styles.digestCard}>
            <Text style={styles.digestHeading}>✨ Weekly Digest</Text>
            <Text style={styles.digestSummary} numberOfLines={3}>{digest.summary}</Text>
            <Text style={styles.digestLink} onPress={() => navigation.navigate('Digest')}>
              See full digest →
            </Text>
          </View>
        )}
      </ScrollView>

      <CardSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 16, paddingBottom: 32 },
  label: {
    color: '#888',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 10,
  },
  card: { width: 180, borderRadius: 14, padding: 16, marginRight: 10, height: 100 },
  cardType: { color: 'rgba(255,255,255,0.7)', fontSize: 9, marginBottom: 8 },
  cardName: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  cardLast: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  addCard: {
    width: 70,
    height: 100,
    borderWidth: 2,
    borderColor: '#2a2a3a',
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardText: { color: '#333', fontSize: 22 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12 },
  statLabel: { color: '#888', fontSize: 10, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  categoryCard: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14, gap: 8 },
  barLabel: { color: '#ccc', fontSize: 12 },
  barBg: { backgroundColor: '#222', borderRadius: 4, height: 5 },
  barFill: { height: 5, borderRadius: 4 },
  digestCard: {
    marginTop: 4,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 10,
    padding: 14,
  },
  digestHeading: {
    color: '#6c63ff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  digestSummary: { color: '#aaa', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  digestLink: { color: '#6c63ff', fontSize: 11 },
})
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke test**

```bash
npx expo start --web
```

Verify:
1. HomeScreen carga sin errores en consola
2. El botón `+` abre el bottom sheet (slide-up visible)
3. Llenar el form con datos inválidos y pulsar Guardar → aparecen mensajes de error inline, el sheet no se cierra
4. Llenar todos los campos correctamente → tarjeta aparece en el carrusel en tiempo real (Firestore `onSnapshot`)
5. Long press en una tarjeta existente → `Alert` con "¿Eliminar esta tarjeta?" aparece
6. Confirmar eliminación → tarjeta desaparece del carrusel en tiempo real
7. Tap en backdrop del sheet → cierra y limpia el formulario

- [ ] **Step 4: Commit y push**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: wire card add/delete in HomeScreen — CardSheet + long-press Alert"
git push
```
