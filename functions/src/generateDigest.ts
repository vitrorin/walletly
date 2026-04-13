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

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const generateDigest = onCall({ secrets: [claudeKey] }, async (request) => {
  // Can be called by client (first import) or scheduler (uid + weekId in data)
  const uid: string = request.data?.uid ?? request.auth?.uid
  const weekId: string = request.data?.weekId

  if (!uid || !weekId) throw new HttpsError('invalid-argument', 'uid and weekId are required')

  const { start, end } = getWeekBounds(weekId)
  const txSnap = await admin
    .firestore()
    .collection('users').doc(uid).collection('transactions')
    .where('date', '>=', start.getTime())
    .where('date', '<=', end.getTime())
    .get()

  const transactions = txSnap.docs.map((d) => d.data() as TransactionData)
  const agg = aggregateTransactions(transactions)

  if (agg.count === 0) return { skipped: true }

  const anthropic = new Anthropic({ apiKey: claudeKey.value() })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: `You are a personal finance assistant. Respond with ONLY valid JSON — no markdown, no explanation — in this exact format:
{
  "summary": "2-3 sentence overview of the week",
  "recommendations": [
    {"title": "Short title", "detail": "1-2 sentence tip with specific numbers from the data"},
    {"title": "Short title", "detail": "..."}
  ]
}
Rules: be concise, realistic, non-judgmental. Include 2-3 recommendations. Acknowledge good habits too. Never invent merchants or amounts not in the data.`,
    messages: [{ role: 'user', content: buildClaudePrompt(agg, weekId) }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  let parsed: { summary: string; recommendations: { title: string; detail: string }[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new HttpsError('internal', 'Claude returned invalid JSON')
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

  return { success: true }
})
