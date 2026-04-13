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
              <Text style={styles.statLabel}>By category</Text>
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
