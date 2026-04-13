import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from './useAuth'
import { Card } from '../types'

export function useCards() {
  const { user } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setCards([]); setLoading(false); return }
    const q = query(collection(db, 'users', user.uid, 'cards'), orderBy('name'))
    return onSnapshot(q, (snap) => {
      setCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as Card)))
      setLoading(false)
    })
  }, [user?.uid])

  return { cards, loading }
}
