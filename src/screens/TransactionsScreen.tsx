import React, { useState, useCallback, memo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../hooks/useAuth'
import { useCards } from '../hooks/useCards'
import { useTransactions } from '../hooks/useTransactions'
import { Card, Transaction, Category } from '../types'

const CATEGORIES: Category[] = ['Dining', 'Groceries', 'Transport', 'Subscriptions', 'Other']

const CATEGORY_COLORS: Record<Category, { text: string; bg: string }> = {
  Dining:        { text: '#9c6fd6', bg: '#2a1a3a' },
  Groceries:     { text: '#6fd66f', bg: '#1a2a1a' },
  Transport:     { text: '#6faad6', bg: '#1a2a3a' },
  Subscriptions: { text: '#d6c06f', bg: '#2a251a' },
  Other:         { text: '#888',    bg: '#2a2a2a' },
}

// ---------------------------------------------------------------------------
// TransactionRow — extracted to avoid inline arrow functions per render row
// ---------------------------------------------------------------------------
interface TransactionRowProps {
  tx: Transaction
  card: Card | undefined
  onToggle: (txId: string, current: boolean) => void
}

const TransactionRow = memo(function TransactionRow({ tx, card, onToggle }: TransactionRowProps) {
  const isExpense = tx.amount < 0
  const amountColor = isExpense ? '#ff6b6b' : '#6fd66f'
  const amountStr = (isExpense ? '-' : '+') + '$' + Math.abs(tx.amount).toFixed(2)
  const dateStr = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const catColors = CATEGORY_COLORS[tx.category]

  const handlePress = useCallback(() => {
    onToggle(tx.id, tx.excluded)
  }, [onToggle, tx.id, tx.excluded])

  return (
    <TouchableOpacity
      style={[styles.txRow, tx.excluded && styles.txRowExcluded]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.txLeft}>
        <Text style={styles.txMerchant}>{tx.merchant}</Text>
        <View style={styles.txMeta}>
          <Text style={styles.txDate}>{dateStr}</Text>
          {card && (
            <Text style={styles.txCard}>· {card.name} ···{card.lastFour}</Text>
          )}
        </View>
      </View>
      <View style={styles.txRight}>
        <Text style={[
          styles.txAmount,
          { color: amountColor },
          tx.excluded && styles.txAmountExcluded,
        ]}>
          {amountStr}
        </Text>
        <View style={[styles.catBadge, { backgroundColor: catColors.bg }]}>
          <Text style={[styles.catBadgeText, { color: catColors.text }]}>
            {tx.category}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
})

// ---------------------------------------------------------------------------
// TransactionsScreen
// ---------------------------------------------------------------------------
export function TransactionsScreen() {
  const { user } = useAuth()
  const { cards, loading: cardsLoading, error: cardsError } = useCards()
  const { transactions, loading: txLoading, error: txError } = useTransactions()

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // I1 — loading / error guards
  if (txLoading || cardsLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    )
  }
  if (txError || cardsError) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Failed to load transactions.</Text>
      </View>
    )
  }

  // C1 — toggleExcluded with error handling
  async function toggleExcluded(txId: string, current: boolean) {
    if (!user) return
    setUpdateError(null)
    try {
      await updateDoc(doc(db, 'users', user.uid, 'transactions', txId), { excluded: !current })
    } catch {
      setUpdateError('Could not update transaction. Check your connection.')
    }
  }

  const filtered = transactions.filter((t) => {
    if (selectedCardId && t.cardId !== selectedCardId) return false
    if (selectedCategory && t.category !== selectedCategory) return false
    return true
  })

  // I3 — stable renderItem for FlatList
  const renderItem = ({ item: tx }: { item: Transaction }) => {
    const card = cards.find((c) => c.id === tx.cardId)
    return (
      <TransactionRow
        tx={tx}
        card={card}
        onToggle={toggleExcluded}
      />
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Text style={styles.headerCount}>{filtered.length} transactions</Text>
      </View>

      {/* Card filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        <TouchableOpacity
          style={[styles.chip, selectedCardId === null && styles.chipActive]}
          onPress={() => setSelectedCardId(null)}
        >
          <Text style={[styles.chipText, selectedCardId === null && styles.chipTextActive]}>
            All cards
          </Text>
        </TouchableOpacity>
        {cards.map((card) => {
          const active = selectedCardId === card.id
          return (
            <TouchableOpacity
              key={card.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedCardId(active ? null : card.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {card.name}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        <TouchableOpacity
          style={[styles.chip, selectedCategory === null && styles.chipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.chipText, selectedCategory === null && styles.chipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedCategory(active ? null : cat)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* C1 — update error banner */}
      {updateError && (
        <TouchableOpacity onPress={() => setUpdateError(null)} style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{updateError}</Text>
        </TouchableOpacity>
      )}

      {/* I3 — FlatList replaces ScrollView for the transaction list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No transactions</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },

  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerCount: { color: '#555', fontSize: 12 },

  chipRow: { flexGrow: 0, marginBottom: 2 },
  chipRowContent: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#2a2a3a',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipActive: {
    borderColor: '#6c63ff',
    backgroundColor: '#1e1a3a',
  },
  chipText: { color: '#555', fontSize: 12 },
  chipTextActive: { color: '#6c63ff' },

  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: '#3a1a1a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  errorBannerText: { color: '#ff6b6b', fontSize: 12 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 2 },

  emptyText: { color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 3,
  },
  txRowExcluded: { opacity: 0.4 },

  txLeft: { flex: 1, marginRight: 12 },
  txMerchant: { color: '#ccc', fontSize: 13, fontWeight: '600', marginBottom: 3 },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txDate: { color: '#888', fontSize: 11 },
  txCard: { color: '#555', fontSize: 11 },

  txRight: { alignItems: 'flex-end', gap: 5 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txAmountExcluded: { textDecorationLine: 'line-through' },

  catBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  catBadgeText: { fontSize: 10, fontWeight: '600' },
})
