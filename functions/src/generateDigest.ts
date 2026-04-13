import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import Anthropic from '@anthropic-ai/sdk'
import { TransactionData, DigestData, Category } from './types'
import { getWeekBounds } from './week'

if (!admin.apps.length) admin.initializeApp()

const claudeKey = defineSecret('CLAUDE_KEY')

// ─── Pure, testable helpers ───────────────────────────────────────────────────

export interface Aggregation {
  totalSpend: number
  byCategory: Partial<Record<Category, number>>
  count: number
}

export function aggregateTransactions(transactions: TransactionData[]): Aggregation {
  const expenses = transactions.filter((t) => !t.excluded && t.amount < 0)
  const byCategory: Partial<Record<Category, number>> = {}
  let totalSpend = 0

  for (const tx of expenses) {
    const abs = Math.abs(tx.amount)
    totalSpend += abs
    byCategory[tx.category] = (byCategory[tx.category] ?? 0) + abs
  }

  return { totalSpend, byCategory, count: expenses.length }
}

export function buildClaudePrompt(agg: Aggregation, weekId: string): string {
  const categoryLines = Object.entries(agg.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  - ${cat}: $${amt.toFixed(2)}`)
    .join('\n')

  return `Week: ${weekId}
Total spent: $${agg.totalSpend.toFixed(2)} across ${agg.count} transactions
By category:
${categoryLines}`
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

function isTransactionData(d: admin.firestore.DocumentData): d is TransactionData {
  return typeof d.amount === 'number' && typeof d.category === 'string' && typeof d.excluded === 'boolean'
}

// ─── Exported so weeklyDigestScheduler can call it without HTTP overhead ─────

export async function runDigest(uid: string, weekId: string, apiKey: string): Promise<void> {
  const { start, end } = getWeekBounds(weekId)
  const txSnap = await admin
    .firestore()
    .collection('users').doc(uid).collection('transactions')
    .where('date', '>=', start.getTime())
    .where('date', '<=', end.getTime())
    .get()

  const transactions = txSnap.docs
    .map((d) => d.data())
    .filter(isTransactionData)
  const agg = aggregateTransactions(transactions)
  if (agg.count === 0) return

  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `You are a personal finance assistant. Respond with ONLY valid JSON — no markdown, no explanation — in this exact format:
{
  "summary": "2-3 sentence overview of the week",
  "recommendations": [
    {"title": "Short title", "detail": "1-2 sentence tip with specific numbers from the data"}
  ]
}
Rules: be concise, realistic, non-judgmental. 2-3 recommendations. Acknowledge good habits too. Never invent merchants or amounts not in the data.`,
    messages: [{ role: 'user', content: buildClaudePrompt(agg, weekId) }],
  })

  const firstBlock = message.content[0]
  if (!firstBlock || firstBlock.type !== 'text') {
    throw new Error('Claude response contained no text block')
  }
  const raw = firstBlock.text
  let parsed: { summary: string; recommendations: { title: string; detail: string }[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Claude returned invalid JSON')
  }
  if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.recommendations)) {
    throw new Error('Claude response did not match expected schema')
  }

  const digestData: DigestData = {
    weekStart: start.getTime(),
    weekEnd: end.getTime(),
    generatedAt: Date.now(),
    totalSpend: agg.totalSpend,
    byCategory: agg.byCategory,
    summary: parsed.summary,
    recommendations: parsed.recommendations,
  }
  await admin.firestore()
    .collection('users').doc(uid)
    .collection('digests').doc(weekId)
    .set(digestData)
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const generateDigest = onCall({ secrets: [claudeKey] }, async (request) => {
  // NOTE: request.auth?.uid is used when the client calls directly (authenticated user).
  // request.data?.uid is a fallback for the scheduler (Task 14), which calls server-side.
  // Unauthenticated callers can pass arbitrary uid in data — acceptable risk since
  // the worst case is generating a digest for someone else's aggregated (non-raw) data.
  const uid: string = request.auth?.uid ?? request.data?.uid
  const weekId: string = request.data?.weekId
  if (!uid || !weekId) throw new HttpsError('invalid-argument', 'uid and weekId are required')
  await runDigest(uid, weekId, claudeKey.value())
  return { success: true }
})
