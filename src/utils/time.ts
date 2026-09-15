export const DAY_START_MIN = 10 * 60
export const DAY_END_MIN = 23 * 60
export const CLOSE_MIN = DAY_END_MIN

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/** Sunday-start week */
export function startOfWeek(key: string): string {
  const d = fromDateKey(key)
  return addDays(key, -d.getDay())
}

export function dateRange(startKey: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(startKey, i))
}

export function formatTime(min: number, compact = false): string {
  const h24 = Math.floor(min / 60)
  const m = min % 60
  const ampm = h24 >= 12 ? 'p' : 'a'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  if (compact) return m === 0 ? `${h12}${ampm}` : `${h12}:${pad(m)}${ampm}`
  return `${h12}:${pad(m)} ${ampm === 'a' ? 'AM' : 'PM'}`
}

export function formatRange(start: number, end: number, compact = false): string {
  const endLabel = end >= CLOSE_MIN ? (compact ? 'CL' : 'Close') : formatTime(end, compact)
  return `${formatTime(start, compact)}–${endLabel}`
}

export function formatDuration(start: number, end: number): string {
  const mins = end - start
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatDateLong(key: string): string {
  const d = fromDateKey(key)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatDateShort(key: string): string {
  const d = fromDateKey(key)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function minToTimeInput(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

export function timeInputToMin(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function nowMin(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Parse spreadsheet-style shorthand like "10-4", "4:40-CL", "11-3", "5-9".
 * Hours <= 9 (and 10/11 when they're the end of a shift starting >= 10) are treated as PM
 * because the restaurant opens at 10am and closes at 11pm.
 */
export function parseShorthand(text: string): { startMin: number; endMin: number } | null {
  const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*-\s*(cl|close|(\d{1,2})(?::(\d{2}))?)$/i)
  if (!m) return null
  const toMin = (hStr: string, mStr: string | undefined, afterMin: number | null) => {
    let h = Number(hStr)
    const mm = mStr ? Number(mStr) : 0
    if (h < 10) h += 12
    else if (afterMin !== null && h * 60 + mm <= afterMin) h += 12
    return h * 60 + mm
  }
  const startMin = toMin(m[1], m[2], null)
  const endMin = /^cl/i.test(m[3]) ? CLOSE_MIN : toMin(m[4], m[5], startMin)
  if (endMin <= startMin) return null
  return { startMin, endMin }
}
