import { useMemo, useState } from 'react'
import type { Employee, Shift } from '../types'
import { shiftColor } from '../utils/colors'
import { addDays, formatShorthand, fromDateKey, startOfWeek, todayKey, WEEKDAYS } from '../utils/time'

interface Props {
  /** Any day inside the month to render (YYYY-MM-DD). */
  month: string
  shifts: Shift[]
  employees: Employee[]
  hideNames?: boolean
  highlightEmployeeId?: string | null
  offeredShiftIds?: Set<string>
  onShiftClick?: (shift: Shift) => void
  onDayClick?: (date: string) => void
  onAddClick?: (date: string) => void
}

/** Spreadsheet divider between the day and evening crews. */
const DIVIDER_MIN = 16 * 60

export function monthRange(month: string): {
  start: string
  end: string
  weeks: string[][]
} {
  const d = fromDateKey(month)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const start = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`
  const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  const weeks: string[][] = []
  let cursor = startOfWeek(start)
  while (cursor <= end) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)))
    cursor = addDays(cursor, 7)
  }
  return { start, end, weeks }
}

export function MonthGrid({
  month,
  shifts,
  employees,
  hideNames,
  highlightEmployeeId,
  offeredShiftIds,
  onShiftClick,
  onDayClick,
  onAddClick,
}: Props) {
  const { weeks } = monthRange(month)
  const monthIdx = fromDateKey(month).getMonth()
  const today = todayKey()
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const byDay = useMemo(() => {
    const m = new Map<string, Shift[]>()
    for (const s of shifts) {
      const list = m.get(s.date) ?? []
      list.push(s)
      m.set(s.date, list)
    }
    for (const list of m.values()) list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
    return m
  }, [shifts])
  const [showDay, setShowDay] = useState(true)
  const [showEvening, setShowEvening] = useState(true)
  const toggle = (part: 'day' | 'evening') => {
    if (part === 'day') setShowDay((v) => !v || !showEvening)
    else setShowEvening((v) => !v || !showDay)
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs">
        <span className="text-slate-500">Show</span>
        {(
          [
            ['day', 'Day (before 4pm)', showDay],
            ['evening', 'Evening (4pm on)', showEvening],
          ] as const
        ).map(([part, label, on]) => (
          <button
            key={part}
            aria-pressed={on}
            onClick={() => toggle(part)}
            className={`chip border px-2.5 py-1 ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-slate-200 last:border-b-0">
          {week.map((d) => {
            const inMonth = fromDateKey(d).getMonth() === monthIdx
            const dayShifts = byDay.get(d) ?? []
            const isToday = d === today
            const dayPart = showDay ? dayShifts.filter((s) => s.startMin < DIVIDER_MIN) : []
            const eveningPart = showEvening ? dayShifts.filter((s) => s.startMin >= DIVIDER_MIN) : []
            const chip = (s: Shift) => {
              const emp = s.employeeId ? empById.get(s.employeeId) : undefined
              const open = !emp
              const mine = highlightEmployeeId && s.employeeId === highlightEmployeeId
              const label =
                hideNames || open
                  ? formatShorthand(s.startMin, s.endMin)
                  : `${emp.name.split(' ')[0]} ${formatShorthand(s.startMin, s.endMin)}`
              return (
                <button
                  key={s.id}
                  title={`${emp?.name ?? 'OPEN'} · ${formatShorthand(s.startMin, s.endMin)} · ${s.position}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onShiftClick?.(s)
                  }}
                  className={`flex w-full items-center gap-1 truncate rounded px-1 py-px text-left text-[11px] leading-4 ${
                    open ? 'border border-dashed border-amber-400 bg-amber-50 text-amber-800' : 'text-slate-800'
                  } ${mine ? 'ring-1 ring-slate-900' : ''}`}
                  style={open ? undefined : { backgroundColor: `${shiftColor(s, emp)}22` }}
                >
                  {!open && (
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: shiftColor(s, emp) }} />
                  )}
                  <span className="truncate">{open ? `OPEN ${label}` : label}</span>
                  {offeredShiftIds?.has(s.id) && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Up for trade" />
                  )}
                </button>
              )
            }
            return (
              <div
                key={d}
                className={`group min-h-[7rem] border-r border-slate-200 p-1 last:border-r-0 ${inMonth ? 'bg-white' : 'bg-slate-50/60'} ${
                  onDayClick ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
                onClick={() => onDayClick?.(d)}
              >
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? 'bg-slate-900 text-white' : inMonth ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {fromDateKey(d).getDate()}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    {dayShifts.length > 0 && <span>{dayShifts.length}</span>}
                    {onAddClick && (
                      <button
                        className="hidden rounded px-1 text-slate-500 hover:bg-slate-200 group-hover:inline"
                        title="Add shift"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddClick(d)
                        }}
                      >
                        +
                      </button>
                    )}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {dayPart.map(chip)}
                  {showDay && showEvening && dayShifts.length > 0 && (
                    <div className="flex items-center gap-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-400">
                      <span className="h-px flex-1 bg-slate-300" />
                      4pm
                      <span className="h-px flex-1 bg-slate-300" />
                    </div>
                  )}
                  {eveningPart.map(chip)}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
