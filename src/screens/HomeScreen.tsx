import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useCards } from '../hooks/useCards'
import { useTransactions } from '../hooks/useTransactions'
import { useDigest } from '../hooks/useDigest'
import { getISOWeekId, getWeekBounds } from '../utils/week'
import { Category } from '../types'
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
  const { cards } = useCards()
  const { transactions } = useTransactions()
  const { digest } = useDigest(WEEK_ID)

  // Filter to this week only
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
        {sorted.length === 0 && <Text style={{ color: '#555', fontSize: 12 }}>No transactions this week</Text>}
      </View>

      {/* Digest preview */}
      {digest && (
        <View style={styles.digestCard}>
          <Text style={styles.digestHeading}>✨ Weekly Digest</Text>
          <Text style={styles.digestSummary} numberOfLines={3}>{digest.summary}</Text>
          <Text style={styles.digestLink} onPress={() => navigation.navigate('Digest')}>See full digest →</Text>
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
