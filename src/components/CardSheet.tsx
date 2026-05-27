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
