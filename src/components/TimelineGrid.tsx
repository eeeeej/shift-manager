import { useMemo } from 'react'
import type { Employee, Shift } from '../types'
import { layoutLanes } from '../utils/lanes'
import { DAY_END_MIN, DAY_START_MIN, formatTime, fromDateKey, nowMin, todayKey, WEEKDAYS } from '../utils/time'
import { TimelineShift } from './ShiftCard'

const HOUR_PX = 56

export function TimelineGrid({
  days,
  shifts,
  employees,
  highlightEmployeeId,
  offeredShiftIds,
  hideNames,
  onShiftClick,
  onSlotClick,
}: {
  days: string[]
  shifts: Shift[]
  employees: Employee[]
  highlightEmployeeId?: string | null
  offeredShiftIds?: Set<string>
  hideNames?: boolean
  onShiftClick?: (shift: Shift) => void
  /** Admin: click an empty area to create a shift at that time. */
  onSlotClick?: (date: string, startMin: number) => void
}) {
  const compact = days.length > 1
  const hours = useMemo(() => {
    const out: number[] = []
    for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) out.push(m)
    return out
  }, [])
  const totalHeight = ((DAY_END_MIN - DAY_START_MIN) / 60) * HOUR_PX
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const today = todayKey()
  const now = nowMin()

  const byDay = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const d of days) map.set(d, [])
    for (const s of shifts) map.get(s.date)?.push(s)
    return map
  }, [days, shifts])

  const toY = (min: number) => ((Math.max(min, DAY_START_MIN) - DAY_START_MIN) / 60) * HOUR_PX

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]" style={{ display: 'grid', gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
          {/* header */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white" />
          {days.map((d) => {
            const date = fromDateKey(d)
            const isToday = d === today
            return (
              <div key={d} className={`sticky top-0 z-10 border-b border-l border-slate-200 bg-white px-2 py-2 text-center ${isToday ? 'bg-slate-50' : ''}`}>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{WEEKDAYS[date.getDay()]}</div>
                <div className={`mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${isToday ? 'bg-slate-900 text-white' : ''}`}>
                  {date.getDate()}
                </div>
              </div>
            )
          })}

          {/* time axis */}
          <div className="relative" style={{ height: totalHeight }}>
            {hours.map((m) => (
              <div
                key={m}
                className={`absolute right-2 text-[11px] text-slate-500 ${m === DAY_START_MIN ? 'pt-0.5' : '-translate-y-1/2'}`}
                style={{ top: toY(m) }}
              >
                {m === DAY_END_MIN ? 'Close' : formatTime(m, true)}
              </div>
            ))}
          </div>

          {/* day columns */}
          {days.map((d) => {
            const laid = layoutLanes(byDay.get(d) ?? [])
            const isToday = d === today
            return (
              <div
                key={d}
                className={`relative border-l border-slate-200 ${isToday ? 'bg-slate-50/60' : ''}`}
                style={{ height: totalHeight }}
                onClick={(e) => {
                  if (!onSlotClick || e.target !== e.currentTarget) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const min = DAY_START_MIN + Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30
                  onSlotClick(d, Math.min(min, DAY_END_MIN - 60))
                }}
              >
                {hours.map((m) => (
                  <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-slate-100" style={{ top: toY(m) }} />
                ))}
                {isToday && now >= DAY_START_MIN && now <= DAY_END_MIN && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: toY(now) }}>
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}
                {laid.map(({ shift, lane, laneCount }) => {
                  const top = toY(shift.startMin)
                  const height = Math.max(toY(Math.min(shift.endMin, DAY_END_MIN)) - top, 22)
                  const gutter = 2
                  const widthPct = 100 / laneCount
                  const emp = shift.employeeId ? empById.get(shift.employeeId) : undefined
                  return (
                    <div
                      key={shift.id}
                      className="absolute"
                      style={{
                        top,
                        height,
                        left: `calc(${lane * widthPct}% + ${gutter}px)`,
                        width: `calc(${widthPct}% - ${gutter * 2}px)`,
                      }}
                    >
                      <TimelineShift
                        shift={shift}
                        employee={emp}
                        compact={compact || laneCount > 2}
                        hideName={hideNames}
                        highlighted={!!highlightEmployeeId && shift.employeeId === highlightEmployeeId}
                        hasOpenOffer={offeredShiftIds?.has(shift.id)}
                        onClick={onShiftClick ? () => onShiftClick(shift) : undefined}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
