import type { Employee, Shift, TimeOffRequest, Unavailability } from '../types'
import { WEEKDAYS_LONG, formatDateShort, formatRange, fromDateKey } from './time'

export const FULL_DAY = { startMin: 0, endMin: 1440 }

export const isFullDay = (w: { startMin: number | null; endMin: number | null }) =>
  w.startMin === null || w.endMin === null || (w.startMin <= 0 && w.endMin >= 1440)

/** "all day" or "10:00 AM – 4:00 PM". */
export function describeWindow(w: { startMin: number | null; endMin: number | null }): string {
  return isFullDay(w) ? 'all day' : formatRange(w.startMin!, w.endMin!)
}

/** "Oct 18" / "Oct 18 – Oct 19" (with weekdays). */
export function describeDates(r: { startDate: string; endDate: string }): string {
  return r.startDate === r.endDate ? formatDateShort(r.startDate) : `${formatDateShort(r.startDate)} – ${formatDateShort(r.endDate)}`
}

/** "Tuesdays" / "Sunday mornings (10:00 AM – 2:00 PM)". */
export function describeUnavailability(u: Unavailability): string {
  const day = `${WEEKDAYS_LONG[u.dow]}s`
  return isFullDay(u) ? day : `${day} ${formatRange(u.startMin, u.endMin)}`
}

const overlaps = (a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }) =>
  a.startMin < b.endMin && b.startMin < a.endMin

function windowOf(w: { startMin: number | null; endMin: number | null }) {
  return isFullDay(w) ? FULL_DAY : { startMin: w.startMin!, endMin: w.endMin! }
}

/** Approved time off for `employeeId` covering `date` (optionally only those touching a time range). */
export function approvedTimeOffOn(
  timeOff: TimeOffRequest[],
  employeeId: string,
  date: string,
  range?: { startMin: number; endMin: number },
): TimeOffRequest[] {
  return timeOff.filter(
    (r) =>
      r.status === 'approved' &&
      r.employeeId === employeeId &&
      r.startDate <= date &&
      date <= r.endDate &&
      (!range || overlaps(windowOf(r), range)),
  )
}

/** Recurring windows of `employee` on the weekday of `date` (optionally only those touching a time range). */
export function unavailabilityOn(employee: Employee, date: string, range?: { startMin: number; endMin: number }): Unavailability[] {
  const dow = fromDateKey(date).getDay()
  return employee.unavailability.filter((u) => u.dow === dow && (!range || overlaps(u, range)))
}

/** Everyone who is off (approved) or unavailable on `date`, for schedule chips. */
export function offOn(
  employees: Employee[],
  timeOff: TimeOffRequest[],
  date: string,
): { employee: Employee; label: string; kind: 'off' | 'unavailable' }[] {
  const out: { employee: Employee; label: string; kind: 'off' | 'unavailable' }[] = []
  for (const e of employees) {
    if (!e.active) continue
    const off = approvedTimeOffOn(timeOff, e.id, date)
    if (off.length) {
      const allDay = off.some(isFullDay)
      out.push({ employee: e, kind: 'off', label: allDay ? 'off' : `off ${formatRange(off[0].startMin!, off[0].endMin!, true)}` })
      continue
    }
    const un = unavailabilityOn(e, date)
    if (un.length) {
      const allDay = un.some(isFullDay)
      out.push({ employee: e, kind: 'unavailable', label: allDay ? 'unavailable' : `unavail. ${formatRange(un[0].startMin, un[0].endMin, true)}` })
    }
  }
  return out
}

/** Warning when scheduling `employee` at the given date/time; `name` omitted for "you". */
export function availabilityWarning(
  employee: Employee | undefined,
  timeOff: TimeOffRequest[],
  range: { date: string; startMin: number; endMin: number },
): string | null {
  if (!employee) return null
  const off = approvedTimeOffOn(timeOff, employee.id, range.date, range)
  if (off.length) return `${employee.name} has approved time off ${describeWindow(off[0])} on ${formatDateShort(range.date)}.`
  const un = unavailabilityOn(employee, range.date, range)
  if (un.length) return `${employee.name} is normally unavailable ${describeUnavailability(un[0])}.`
  return null
}

/** Shifts already assigned to the requester inside a time-off request. */
export function shiftsDuring(shifts: Shift[], r: TimeOffRequest): Shift[] {
  return shifts.filter(
    (s) => s.employeeId === r.employeeId && s.date >= r.startDate && s.date <= r.endDate && overlaps(s, windowOf(r)),
  )
}
