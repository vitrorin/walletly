import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import * as crypto from 'crypto'
import { parseCSVText } from './csvParser'

if (!admin.apps.length) admin.initializeApp()

export const parseCSV = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required')

  const { csvText, cardId } = request.data as { csvText: string; cardId: string }
  if (!csvText || !cardId) throw new HttpsError('invalid-argument', 'csvText and cardId are required')

  const uid = request.auth.uid

  // Deduplicate by file hash
  const fileHash = crypto.createHash('sha256').update(csvText).digest('hex')
  const userRef = admin.firestore().collection('users').doc(uid)
  const userSnap = await userRef.get()
  const importHashes: string[] = userSnap.data()?.importHashes ?? []

  if (importHashes.includes(fileHash)) {
    throw new HttpsError('already-exists', 'This file has already been imported')
  }

  let transactions
  try {
    transactions = parseCSVText(csvText, cardId)
  } catch (e: any) {
    throw new HttpsError('invalid-argument', e.message ?? 'Could not parse CSV')
  }

  if (transactions.length === 0) {
    throw new HttpsError('invalid-argument', 'No valid transactions found in CSV')
  }

  return { transactions, fileHash }
})
