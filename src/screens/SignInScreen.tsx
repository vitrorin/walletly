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
