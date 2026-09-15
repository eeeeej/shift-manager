import { Copy } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Employee, Position, Shift, ShiftInput } from '../types'
import { shiftColor } from '../utils/colors'
import { addDays, formatShorthand, fromDateKey, startOfWeek, todayKey, WEEKDAYS } from '../utils/time'
import { QuickAddPopover } from './QuickAddPopover'

interface Props {
  /** Consecutive months to render, each as YYYY-MM-01. */
  months: string[]
  shifts: Shift[]
  employees: Employee[]
  hideNames?: boolean
  highlightEmployeeId?: string | null
  offeredShiftIds?: Set<string>
  onShiftClick?: (shift: Shift) => void
  onDayClick?: (date: string) => void
  /** Open the full shift editor (admin). Enables the quick-add popover and drag-to-move. */
  onAddClick?: (draft: Partial<ShiftInput> & { date: string }) => void
  onQuickAdd?: (input: ShiftInput) => Promise<void>
  /** Drop a chip on another day: move it, or duplicate when `copy` (Shift held). */
  onMoveShift?: (shift: Shift, date: string, copy: boolean) => void
  /** Copy an entire week (Sunday key) — shows a gutter button per week row. */
  onCopyWeek?: (weekStart: string) => void
  defaultPosition?: Position
  /** Called when the user scrolls near the top / bottom; parent prepends / appends a month. */
  onNeedBefore: () => void
  onNeedAfter: () => void
  /** Month whose header is currently at the top of the viewport. */
  onVisibleMonth: (month: string) => void
  /** Bump `key` to scroll `month` into view. */
  scrollTarget: { month: string; key: number } | null
}

/** Spreadsheet divider between the day and evening crews. */
const DIVIDER_MIN = 16 * 60

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
  hideNames,
  highlightEmployeeId,
  offeredShiftIds,
  onShiftClick,
  onDayClick,
  onAddClick,
  onQuickAdd,
  onMoveShift,
  onCopyWeek,
  defaultPosition = 'Server',
  onNeedBefore,
  onNeedAfter,
  onVisibleMonth,
  scrollTarget,
}: Props) {
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
  const [quickAdd, setQuickAdd] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const dragging = useRef<Shift | null>(null)
  const editable = !!onAddClick
  const [showDay, setShowDay] = useState(true)
  const [showEvening, setShowEvening] = useState(true)
  const toggle = (part: 'day' | 'evening') => {
    if (part === 'day') setShowDay((v) => !v || !showEvening)
    else setShowEvening((v) => !v || !showDay)
  }

  const scroller = useRef<HTMLDivElement>(null)
  const blocks = useRef(new Map<string, HTMLElement>())
  const topSentinel = useRef<HTMLDivElement>(null)
  const bottomSentinel = useRef<HTMLDivElement>(null)
  // Keep the viewport anchored when a month is prepended above.
  const firstMonth = months[0]
  const prevFirst = useRef(firstMonth)
  const prevHeight = useRef(0)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (prevFirst.current !== firstMonth && firstMonth < prevFirst.current) {
      el.scrollTop += el.scrollHeight - prevHeight.current
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
    const top = el.getBoundingClientRect().top + 8
    let current = months[0]
    for (const m of months) {
      const b = blocks.current.get(m)
      if (b && b.getBoundingClientRect().top <= top) current = m
    }
    onVisibleMonth(current)
  }
  useEffect(updateVisible, [months]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scrollTarget) return
    const el = scroller.current
    const b = blocks.current.get(scrollTarget.month)
    if (el && b) el.scrollTop = b.offsetTop
  }, [scrollTarget, months])

  const cell = (month: string, d: string) => {
    const inMonth = fromDateKey(d).getMonth() === fromDateKey(month).getMonth()
    const dayShifts = inMonth ? (byDay.get(d) ?? []) : []
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
          title={`${emp?.name ?? 'OPEN'} · ${formatShorthand(s.startMin, s.endMin)} · ${s.position}${
            onMoveShift ? ' — drag to move, Shift+drag to copy' : ''
          }`}
          draggable={!!onMoveShift}
          onDragStart={(e) => {
            dragging.current = s
            e.dataTransfer.effectAllowed = 'copyMove'
            e.dataTransfer.setData('text/plain', s.id)
          }}
          onDragEnd={() => {
            dragging.current = null
            setDragOver(null)
          }}
          onClick={(e) => {
            e.stopPropagation()
            onShiftClick?.(s)
          }}
          className={`flex w-full items-center gap-1 truncate rounded px-1 py-px text-left text-[11px] leading-4 ${
            open ? 'border border-dashed border-amber-400 bg-amber-50 text-amber-800' : 'text-slate-800'
          } ${mine ? 'ring-1 ring-slate-900' : ''} ${onMoveShift ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={open ? undefined : { backgroundColor: `${shiftColor(s, emp)}22` }}
        >
          {!open && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: shiftColor(s, emp) }} />}
          <span className="truncate">{open ? `OPEN ${label}` : label}</span>
          {offeredShiftIds?.has(s.id) && (
            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Up for trade" />
          )}
        </button>
      )
    }
    const dayCount = dayShifts.filter((s) => s.startMin < DIVIDER_MIN).length
    const eveCount = dayShifts.length - dayCount
    const openCount = dayShifts.filter((s) => !s.employeeId).length
    const droppable = !!onMoveShift && inMonth
    return (
      <div
        key={d}
        className={`group relative min-h-[7rem] border-r border-slate-200 p-1 last:border-r-0 ${inMonth ? 'bg-white' : 'bg-slate-50/60'} ${
          onDayClick ? 'cursor-pointer hover:bg-slate-50' : ''
        } ${dragOver === d ? 'bg-sky-50 ring-2 ring-inset ring-sky-400' : ''}`}
        onClick={() => onDayClick?.(d)}
        onDragOver={
          droppable
            ? (e) => {
                if (!dragging.current) return
                e.preventDefault()
                e.dataTransfer.dropEffect = e.shiftKey ? 'copy' : 'move'
                if (dragOver !== d) setDragOver(d)
              }
            : undefined
        }
        onDragLeave={droppable ? () => setDragOver((v) => (v === d ? null : v)) : undefined}
        onDrop={
          droppable
            ? (e) => {
                e.preventDefault()
                const s = dragging.current
                dragging.current = null
                setDragOver(null)
                if (!s) return
                const copy = e.shiftKey
                if (s.date === d && !copy) return
                onMoveShift?.(s, d, copy)
              }
            : undefined
        }
      >
        {quickAdd === d && onQuickAdd && onAddClick && (
          <QuickAddPopover
            date={d}
            employees={employees}
            defaultPosition={defaultPosition}
            onSubmit={onQuickAdd}
            onMore={(draft) => {
              setQuickAdd(null)
              onAddClick({ ...draft, date: d })
            }}
            onClose={() => setQuickAdd(null)}
          />
        )}
        <div className="mb-1 flex items-center justify-between px-0.5">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              isToday ? 'bg-slate-900 text-white' : inMonth ? 'text-slate-700' : 'text-slate-400'
            }`}
          >
            {fromDateKey(d).getDate()}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            {dayShifts.length > 0 && (
              <span title={`${dayCount} before 4pm · ${eveCount} from 4pm${openCount ? ` · ${openCount} open` : ''}`}>
                {dayCount} day · {eveCount} eve
                {openCount > 0 && <span className="ml-1 font-semibold text-amber-600">{openCount} open</span>}
              </span>
            )}
            {editable && (
              <button
                className={`rounded px-1 text-slate-500 hover:bg-slate-200 ${quickAdd === d ? 'inline bg-slate-200' : 'hidden group-hover:inline'}`}
                title="Add shift"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onQuickAdd) setQuickAdd(quickAdd === d ? null : d)
                  else onAddClick?.({ date: d })
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
  }

  const gutter = !!onCopyWeek
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
