/** Returns ISO week ID string, e.g. "2026-W15" */
export function getISOWeekId(date: Date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/** Returns Monday 00:00:00 and Sunday 23:59:59 for a given ISO week ID */
export function getWeekBounds(weekId: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekId.split('-W')
  const year = Number(yearStr)
  const week = Number(weekStr)
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = (jan4.getDay() + 6) % 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + (week - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}
