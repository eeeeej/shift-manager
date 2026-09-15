import { Copy } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { Employee, Shift } from '../types'
import { addDays, fromDateKey, startOfWeek, todayKey, WEEKDAYS } from '../utils/time'
import { DayCell, DayPartToggle, groupByDay, useDayCellState, type DayCellCallbacks } from './DayCell'

interface Props extends DayCellCallbacks {
  /** Consecutive months to render, each as YYYY-MM-01. */
  months: string[]
  shifts: Shift[]
  employees: Employee[]
  /** Copy an entire week (Sunday key) — shows a gutter button per week row. */
  onCopyWeek?: (weekStart: string) => void
  /** Called when the user scrolls near the top / bottom; parent prepends / appends a month. */
  onNeedBefore: () => void
  onNeedAfter: () => void
  /** Month whose header is currently at the top of the viewport. */
  onVisibleMonth: (month: string) => void
  /** Bump `key` to scroll `month` into view. */
  scrollTarget: { month: string; key: number } | null
}

export function monthKey(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function addMonths(month: string, n: number): string {
  const d = fromDateKey(month)
  const m = new Date(d.getFullYear(), d.getMonth() + n, 1)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
}

export function monthRange(month: string): { start: string; end: string; weeks: string[][] } {
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

export function formatMonth(month: string): string {
  return fromDateKey(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function MonthGrid({
  months,
  shifts,
  employees,
  onCopyWeek,
  onNeedBefore,
  onNeedAfter,
  onVisibleMonth,
  scrollTarget,
  ...cellProps
}: Props) {
  const today = todayKey()
  const byDay = useMemo(() => groupByDay(shifts), [shifts])
  const state = useDayCellState()

  const scroller = useRef<HTMLDivElement>(null)
  const blocks = useRef(new Map<string, HTMLElement>())
  const topSentinel = useRef<HTMLDivElement>(null)
  const bottomSentinel = useRef<HTMLDivElement>(null)
  // Keep the viewport anchored when a month is prepended above.
  const firstMonth = months[0]
  const prevFirst = useRef(firstMonth)
  const prevHeight = useRef(0)
  // Programmatic scroll positions, so onScroll can tell a user scroll from ours.
  const lastSet = useRef(0)
  const setScroll = (el: HTMLElement, top: number) => {
    el.scrollTop = top
    lastSet.current = el.scrollTop
  }
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (prevFirst.current !== firstMonth && firstMonth < prevFirst.current) {
      setScroll(el, el.scrollTop + el.scrollHeight - prevHeight.current)
    }
    prevFirst.current = firstMonth
    prevHeight.current = el.scrollHeight
  }, [firstMonth, months.length])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          if (e.target === topSentinel.current) onNeedBefore()
          if (e.target === bottomSentinel.current) onNeedAfter()
        }
      },
      { root: el, rootMargin: '200px 0px' },
    )
    if (topSentinel.current) io.observe(topSentinel.current)
    if (bottomSentinel.current) io.observe(bottomSentinel.current)
    return () => io.disconnect()
  }, [onNeedBefore, onNeedAfter])

  const updateVisible = () => {
    const el = scroller.current
    if (!el) return
    if (Math.abs(el.scrollTop - lastSet.current) > 2) pinned.current = false
    const top = el.getBoundingClientRect().top + 8
    let current = months[0]
    for (const m of months) {
      const b = blocks.current.get(m)
      if (b && b.getBoundingClientRect().top <= top) current = m
    }
    onVisibleMonth(current)
  }
  useEffect(updateVisible, [months]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stay pinned to the target month while months/shifts load and reflow, until the user scrolls.
  const pinned = useRef(false)
  const handledKey = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (!scrollTarget) return
    if (handledKey.current !== scrollTarget.key) {
      handledKey.current = scrollTarget.key
      pinned.current = true
    }
    if (!pinned.current) return
    const el = scroller.current
    const b = blocks.current.get(scrollTarget.month)
    if (el && b) setScroll(el, b.offsetTop)
  }, [scrollTarget, months, shifts])

  const cell = (month: string, d: string) => (
    <DayCell
      key={d}
      date={d}
      shifts={byDay.get(d) ?? []}
      label={fromDateKey(d).getDate()}
      muted={fromDateKey(d).getMonth() !== fromDateKey(month).getMonth()}
      isToday={d === today}
      employees={employees}
      state={state}
      className="border-r border-slate-200 last:border-r-0"
      {...cellProps}
    />
  )

  const gutter = !!onCopyWeek
  return (
    <div className="card overflow-hidden">
      <DayPartToggle state={state} />
      <div
        className={`grid ${gutter ? 'grid-cols-[1.75rem_repeat(7,minmax(0,1fr))]' : 'grid-cols-7'} border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase tracking-wide text-slate-500`}
      >
        {gutter && <div />}
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div
        ref={scroller}
        onScroll={updateVisible}
        className="relative max-h-[calc(100vh-16rem)] min-h-[24rem] overflow-y-auto"
      >
        <div ref={topSentinel} className="h-px" />
        {months.map((month) => (
          <section
            key={month}
            ref={(node) => {
              if (node) blocks.current.set(month, node)
              else blocks.current.delete(month)
            }}
          >
            <h3 className="sticky top-0 z-10 border-y border-slate-200 bg-white/95 px-3 py-1.5 text-sm font-semibold text-slate-900 backdrop-blur">
              {formatMonth(month)}
            </h3>
            {monthRange(month).weeks.map((week, wi) => (
              <div
                key={wi}
                className={`group/week grid ${gutter ? 'grid-cols-[1.75rem_repeat(7,minmax(0,1fr))]' : 'grid-cols-7'} border-b border-slate-200`}
              >
                {gutter && (
                  <div className="flex items-start justify-center border-r border-slate-200 bg-slate-50/60 pt-2">
                    <button
                      className="rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover/week:opacity-100 focus:opacity-100"
                      title={`Copy week of ${fromDateKey(week[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} to another week`}
                      aria-label={`Copy week of ${week[0]}`}
                      onClick={() => onCopyWeek?.(week[0])}
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                )}
                {week.map((d) => cell(month, d))}
              </div>
            ))}
          </section>
        ))}
        <div ref={bottomSentinel} className="h-px" />
      </div>
    </div>
  )
}
