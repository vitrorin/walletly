import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from './useAuth'
import { Digest } from '../types'

export function useDigest(weekId: string) {
  const { user } = useAuth()
  const [digest, setDigest] = useState<Digest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user) { setDigest(null); setLoading(false); return }
    setLoading(true)
    const ref = doc(db, 'users', user.uid, 'digests', weekId)
    return onSnapshot(ref, (snap) => {
      setDigest(snap.exists() ? (() => {
        const data = snap.data()
        return {
          weekId: snap.id,
          weekStart: data.weekStart ?? 0,
          weekEnd: data.weekEnd ?? 0,
          generatedAt: data.generatedAt ?? 0,
          totalSpend: data.totalSpend ?? 0,
          byCategory: data.byCategory ?? {},
          summary: data.summary ?? '',
          recommendations: data.recommendations ?? [],
        } satisfies Digest
      })() : null)
      setLoading(false)
    }, (err) => {
      setError(err)
      setLoading(false)
    })
  }, [user?.uid, weekId])

  return { digest, loading, error }
}
