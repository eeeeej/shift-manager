import type { Employee, Shift } from '../types'

export function shiftColor(shift: Shift, employee: Employee | undefined): string {
  return shift.color ?? employee?.color ?? '#94a3b8'
}

export const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
  '#f43f5e', '#0ea5e9', '#10b981', '#a855f7', '#eab308', '#64748b',
]

/** Pick the least-used palette color among existing ones. */
export function nextColor(used: string[]): string {
  const counts = new Map(PALETTE.map((c) => [c, 0]))
  for (const c of used) if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1)
  let best = PALETTE[0]
  let min = Infinity
  for (const c of PALETTE) {
    const n = counts.get(c) ?? 0
    if (n < min) {
      min = n
      best = c
    }
  }
  return best
}

export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
