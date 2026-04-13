import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from './useAuth'
import { Digest } from '../types'

export function useDigest(weekId: string) {
  const { user } = useAuth()
  const [digest, setDigest] = useState<Digest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setDigest(null); setLoading(false); return }
    const ref = doc(db, 'users', user.uid, 'digests', weekId)
    return onSnapshot(ref, (snap) => {
      setDigest(snap.exists() ? { weekId: snap.id, ...snap.data() } as Digest : null)
      setLoading(false)
    })
  }, [user?.uid, weekId])

  return { digest, loading }
}
