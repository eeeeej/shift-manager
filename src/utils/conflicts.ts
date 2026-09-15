import type { Shift } from '../types'
import { formatRange } from './time'

export interface Conflicts {
  /** Other shifts the employee already has on that date. */
  sameDay: Shift[]
  /** Whether any of them overlap the given time range. */
  overlap: boolean
}

export function findConflicts(
  shifts: Shift[],
  employeeId: string | null | undefined,
  range: { date: string; startMin: number; endMin: number },
  excludeShiftId?: string,
): Conflicts {
  if (!employeeId) return { sameDay: [], overlap: false }
  const sameDay = shifts.filter(
    (s) => s.employeeId === employeeId && s.date === range.date && s.id !== excludeShiftId,
  )
  const overlap = sameDay.some((s) => s.startMin < range.endMin && range.startMin < s.endMin)
  return { sameDay, overlap }
}

/** Warning text; `name` for a third person, omitted for "you". */
export function conflictMessage(c: Conflicts, name?: string): string | null {
  if (c.sameDay.length === 0) return null
  const times = c.sameDay.map((s) => formatRange(s.startMin, s.endMin)).join(' and ')
  if (c.overlap) return name ? `Overlaps ${name}'s ${times} that day.` : `Overlaps your ${times} that day.`
  return name ? `${name} is already on ${times} that day.` : `You're already on ${times} that day.`
}

/** Ask before proceeding when the assignment overlaps an existing shift. */
export function confirmOverlap(c: Conflicts, name?: string): boolean {
  if (!c.overlap) return true
  return confirm(
    name
      ? `${name} already has a shift at that time. Assign it anyway?`
      : 'This overlaps a shift you already have that day. Claim it anyway?',
  )
}
