import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from './useAuth'
import { Transaction } from '../types'

export function useTransactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user) { setTransactions([]); setLoading(false); return }
    setLoading(true)
    const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'))
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          cardId: data.cardId ?? '',
          date: typeof data.date === 'number' ? data.date : (data.date?.toMillis?.() ?? 0),
          amount: data.amount ?? 0,
          merchant: data.merchant ?? '',
          category: data.category ?? 'Other',
          rawDescription: data.rawDescription ?? '',
          excluded: data.excluded ?? false,
        } satisfies Transaction
      }))
      setLoading(false)
    }, (err) => {
      setError(err)
      setLoading(false)
    })
  }, [user?.uid])

  return { transactions, loading, error }
}
