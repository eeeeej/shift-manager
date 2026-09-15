import { useMemo } from 'react'
import type { Employee, Shift } from '../types'
import { formatDateLong, fromDateKey, todayKey, WEEKDAYS } from '../utils/time'
import { DayCell, DayPartToggle, groupByDay, useDayCellState, type DayCellCallbacks } from './DayCell'

interface Props extends DayCellCallbacks {
  days: string[]
  shifts: Shift[]
  employees: Employee[]
  /** Stack days vertically (phones) instead of one column per day. */
  stacked?: boolean
}

/** Condensed multi-day view: the month grid's chip cells laid out for an arbitrary run of days. */
export function DayList({ days, shifts, employees, stacked, ...cellProps }: Props) {
  const today = todayKey()
  const byDay = useMemo(() => groupByDay(shifts), [shifts])
  const state = useDayCellState()
  return (
    <div className="card overflow-hidden">
      <DayPartToggle state={state} />
      <div
        className={stacked ? 'divide-y divide-slate-200' : 'grid divide-x divide-slate-200'}
        style={stacked ? undefined : { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((d) => {
          const date = fromDateKey(d)
          return (
            <DayCell
              key={d}
              date={d}
              shifts={byDay.get(d) ?? []}
              label={stacked ? formatDateLong(d) : `${WEEKDAYS[date.getDay()]} ${date.getDate()}`}
              isToday={d === today}
              employees={employees}
              state={state}
              className={stacked ? 'min-h-0' : ''}
              {...cellProps}
            />
          )
        })}
      </div>
    </div>
  )
}
