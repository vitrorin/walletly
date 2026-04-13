import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from './useAuth'
import { Card } from '../types'

export function useCards() {
  const { user } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user) { setCards([]); setLoading(false); return }
    setLoading(true)
    const q = query(collection(db, 'users', user.uid, 'cards'), orderBy('name'))
    return onSnapshot(q, (snap) => {
      setCards(snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name ?? '',
          type: data.type ?? 'debit',
          bank: data.bank ?? '',
          lastFour: data.lastFour ?? '',
          color: data.color ?? '#6c63ff',
        } satisfies Card
      }))
      setLoading(false)
    }, (err) => {
      setError(err)
      setLoading(false)
    })
  }, [user?.uid])

  return { cards, loading, error }
}
