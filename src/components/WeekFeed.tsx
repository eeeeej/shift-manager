import { Copy } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { Employee, Shift } from '../types'
import { addDays, fromDateKey, todayKey, WEEKDAYS } from '../utils/time'
import { DayCell, DayPartToggle, groupByDay, useDayCellState, type DayCellCallbacks } from './DayCell'

interface Props extends DayCellCallbacks {
  /** Consecutive weeks to render, each as its Sunday key. */
  weeks: string[]
  shifts: Shift[]
  employees: Employee[]
  onCopyWeek?: (weekStart: string) => void
  onNeedBefore: () => void
  onNeedAfter: () => void
  /** Week whose header is currently at the top of the viewport. */
  onVisibleWeek: (week: string) => void
  /** Bump `key` to scroll `week` into view. */
  scrollTarget: { week: string; key: number } | null
}

export function formatWeek(sunday: string): string {
  const a = fromDateKey(sunday)
  const b = fromDateKey(addDays(sunday, 6))
  const from = a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const to =
    a.getMonth() === b.getMonth()
      ? `${b.getDate()}, ${b.getFullYear()}`
      : b.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${from} – ${to}`
}

/** Continuous feed of week rows (list layout); weeks load as the user scrolls. */
export function WeekFeed({
  weeks,
  shifts,
  employees,
  onCopyWeek,
  onNeedBefore,
  onNeedAfter,
  onVisibleWeek,
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
  const firstWeek = weeks[0]
  const prevFirst = useRef(firstWeek)
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
    if (prevFirst.current !== firstWeek && firstWeek < prevFirst.current) {
      setScroll(el, el.scrollTop + el.scrollHeight - prevHeight.current)
    }
    prevFirst.current = firstWeek
    prevHeight.current = el.scrollHeight
  }, [firstWeek, weeks.length])

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
    let current = weeks[0]
    for (const w of weeks) {
      const b = blocks.current.get(w)
      if (b && b.getBoundingClientRect().top <= top) current = w
    }
    onVisibleWeek(current)
  }
  useEffect(updateVisible, [weeks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stay pinned to the target week while weeks/shifts load and reflow, until the user scrolls.
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
    const b = blocks.current.get(scrollTarget.week)
    if (el && b) setScroll(el, b.offsetTop)
  }, [scrollTarget, weeks, shifts])

  const gutter = !!onCopyWeek
  const cols = gutter ? 'grid-cols-[1.75rem_repeat(7,minmax(0,1fr))]' : 'grid-cols-7'
  return (
    <div className="card overflow-hidden">
      <DayPartToggle state={state} />
      <div
        className={`grid ${cols} border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase tracking-wide text-slate-500`}
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
        {weeks.map((week) => {
          const isThisWeek = week === weeks.find((w) => w <= today && addDays(w, 6) >= today)
          return (
            <section
              key={week}
              ref={(node) => {
                if (node) blocks.current.set(week, node)
                else blocks.current.delete(week)
              }}
              className="group/week"
            >
              <h3 className="sticky top-0 z-10 flex items-center gap-2 border-y border-slate-200 bg-white/95 px-3 py-1.5 text-sm font-semibold text-slate-900 backdrop-blur">
                {formatWeek(week)}
                {isThisWeek && <span className="chip bg-slate-900 text-white">This week</span>}
              </h3>
              <div className={`grid ${cols} border-b border-slate-200`}>
                {gutter && (
                  <div className="flex items-start justify-center border-r border-slate-200 bg-slate-50/60 pt-2">
                    <button
                      className="rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover/week:opacity-100 focus:opacity-100"
                      title="Copy this week to another week"
                      aria-label={`Copy week of ${week}`}
                      onClick={() => onCopyWeek?.(week)}
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                )}
                {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d) => (
                  <DayCell
                    key={d}
                    date={d}
                    shifts={byDay.get(d) ?? []}
                    label={fromDateKey(d).getDate()}
                    isToday={d === today}
                    employees={employees}
                    state={state}
                    className="border-r border-slate-200 last:border-r-0"
                    {...cellProps}
                  />
                ))}
              </div>
            </section>
          )
        })}
        <div ref={bottomSentinel} className="h-px" />
      </div>
    </div>
  )
}
