import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform, Alert,
} from 'react-native'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  collection, doc, writeBatch, updateDoc, arrayUnion,
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
  const { cards } = useCards()
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
      const result = await pickFileWeb()
      if (!result) return  // user cancelled
      csvText = result
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
      const BATCH_LIMIT = 500
      const txChunks: typeof parsed.transactions[] = []
      for (let i = 0; i < parsed.transactions.length; i += BATCH_LIMIT) {
        txChunks.push(parsed.transactions.slice(i, i + BATCH_LIMIT))
      }
      for (const chunk of txChunks) {
        const batch = writeBatch(db)
        for (const tx of chunk) {
          const ref = doc(collection(db, 'users', user.uid, 'transactions'), uuid())
          batch.set(ref, tx)
        }
        await batch.commit()
      }
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

async function pickFileWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    // @ts-ignore — document is available in web environment
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,text/csv'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      resolve(await file.text())
    }
    // Resolve null if dialog is dismissed without selection
    input.addEventListener('cancel', () => resolve(null))
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
