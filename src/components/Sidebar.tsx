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
          <TouchableOpacity key={tab.name} style={[styles.item, active && styles.itemActive]} onPress={() => navigation.navigate(tab.name)}>
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
