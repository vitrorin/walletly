import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import { runDigest } from './generateDigest'
import { getISOWeekId } from './week'

if (!admin.apps.length) admin.initializeApp()

const claudeKey = defineSecret('CLAUDE_KEY')

export const weeklyDigestScheduler = onSchedule(
  { schedule: '0 13 * * 1', timeZone: 'UTC', secrets: [claudeKey] },
  async () => {
    const weekId = getISOWeekId(new Date())
    const usersSnap = await admin.firestore().collection('users').get()

    await Promise.allSettled(
      usersSnap.docs.map(async (userDoc) => {
        const uid = userDoc.id
        const txSnap = await admin
          .firestore()
          .collection('users').doc(uid).collection('transactions')
          .limit(1)
          .get()
        if (txSnap.empty) return
        await runDigest(uid, weekId, claudeKey.value())
      })
    )
  }
)
