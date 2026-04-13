import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import { runDigest } from './generateDigest'
import { getISOWeekId, getWeekBounds } from './week'

if (!admin.apps.length) admin.initializeApp()

const claudeKey = defineSecret('CLAUDE_KEY')

export const weeklyDigestScheduler = onSchedule(
  { schedule: '0 13 * * 1', timeZone: 'UTC', secrets: [claudeKey] },
  async () => {
    const weekId = getISOWeekId(new Date())
    const usersSnap = await admin.firestore().collection('users').get()

    const { start, end } = getWeekBounds(weekId)

    const results = await Promise.allSettled(
      usersSnap.docs.map(async (userDoc) => {
        const uid = userDoc.id
        const txSnap = await admin
          .firestore()
          .collection('users').doc(uid).collection('transactions')
          .where('date', '>=', start.getTime())
          .where('date', '<=', end.getTime())
          .limit(1)
          .get()
        if (txSnap.empty) return
        await runDigest(uid, weekId, claudeKey.value())
      })
    )

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failures.length > 0) {
      console.error(
        `weeklyDigestScheduler: ${failures.length}/${results.length} users failed`,
        failures.map((f) => f.reason)
      )
    }
  }
)
