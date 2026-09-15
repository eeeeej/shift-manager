import { ChevronLeft, ChevronRight, Copy, Plus } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CopyWeekModal, type CopyResult } from '../components/CopyWeekModal'
import { ShiftRow } from '../components/ShiftCard'
import { ShiftDetailModal } from '../components/ShiftDetailModal'
import { ShiftModal, type ShiftDraft } from '../components/ShiftModal'
import { addMonths, formatMonth, MonthGrid, monthKey, monthRange } from '../components/MonthGrid'
import { DayList } from '../components/DayList'
import { TimelineGrid } from '../components/TimelineGrid'
import { EmptyState, PageHeader } from '../components/ui'
import { useData } from '../data/DataContext'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { POSITIONS, type Position, type Shift } from '../types'
import { addDays, dateRange, formatDateLong, fromDateKey, startOfWeek, todayKey } from '../utils/time'

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`chip border py-1 transition ${
        active
          ? 'border-transparent text-white'
          : color
            ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
      style={active ? { backgroundColor: color ?? '#0f172a' } : undefined}
    >
      {color && !active && <span className="mr-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </button>
  )
}

const VIEW_KEY = 'shift-manager:schedule:view'
const LAYOUT_KEY = 'shift-manager:schedule:layout'

export function Schedule() {
  const { shifts, employees, offers, isAdmin, me, employeeById, createShift, updateShift, createShifts, deleteShifts } =
    useData()
  const isDesktop = useIsDesktop()
  // Managers build the schedule in the month grid, so it's their default (last choice remembered).
  const [view, setViewState] = useState<'week' | 'month'>(() => {
    if (!isAdmin) return 'week'
    return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'month'
  })
  const setView = (v: 'week' | 'month') => {
    setViewState(v)
    if (isAdmin) localStorage.setItem(VIEW_KEY, v)
  }
  // Multi-day ranges start on today rather than snapping to Sunday.
  const [days, setDays] = useState(isAdmin ? 7 : 1)
  const [start, setStart] = useState(todayKey)
  // Desktop multi-day: time axis or condensed chip columns.
  const [layout, setLayoutState] = useState<'timeline' | 'list'>(() =>
    localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'timeline',
  )
  const setLayout = (l: 'timeline' | 'list') => {
    setLayoutState(l)
    localStorage.setItem(LAYOUT_KEY, l)
  }
  const isMonth = view === 'month'
  const [months, setMonths] = useState<string[]>(() => {
    const m = monthKey(todayKey())
    return [m, addMonths(m, 1)]
  })
  const [visibleMonth, setVisibleMonth] = useState(() => monthKey(todayKey()))
  const [scrollTarget, setScrollTarget] = useState<{ month: string; key: number } | null>(null)
  const needBefore = useCallback(() => setMonths((ms) => [addMonths(ms[0], -1), ...ms]), [])
  const needAfter = useCallback(() => setMonths((ms) => [...ms, addMonths(ms[ms.length - 1], 1)]), [])
  const jumpToMonth = (m: string) => {
    setMonths((ms) => {
      let next = ms
      while (m < next[0]) next = [addMonths(next[0], -1), ...next]
      while (m > next[next.length - 1]) next = [...next, addMonths(next[next.length - 1], 1)]
      return next
    })
    setScrollTarget((t) => ({ month: m, key: (t?.key ?? 0) + 1 }))
  }
  const [position, setPosition] = useState<Position | ''>('')
  const [employeeFilter, setEmployeeFilter] = useState<Set<string>>(() => new Set())
  const toggleEmployee = (id: string) =>
    setEmployeeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const [draft, setDraft] = useState<ShiftDraft | null>(null)
  const [detail, setDetail] = useState<Shift | null>(null)
  const [copying, setCopying] = useState<string | null>(null)
  const [lastCopy, setLastCopy] = useState<CopyResult | null>(null)
  const [undoing, setUndoing] = useState(false)

  const finishCopy = (r: CopyResult) => {
    setCopying(null)
    setLastCopy(r)
    if (isMonth) jumpToMonth(monthKey(r.targetStart))
    else setStart(r.targetStart)
  }
  const moveShift = (s: Shift, date: string, copy: boolean) => {
    if (copy) {
      const { id: _id, ...rest } = s
      void createShift({ ...rest, date })
    } else {
      void updateShift(s.id, { date })
    }
  }
  const undoCopy = async () => {
    if (!lastCopy) return
    setUndoing(true)
    try {
      await deleteShifts(lastCopy.created.map((s) => s.id))
      if (lastCopy.removed.length) await createShifts(lastCopy.removed.map(({ id: _id, ...rest }) => rest))
      setLastCopy(null)
    } finally {
      setUndoing(false)
    }
  }

  const range = useMemo(() => {
    if (!isMonth) return dateRange(start, days)
    const s = monthRange(months[0]).start
    const end = monthRange(months[months.length - 1]).end
    return dateRange(s, Math.round((fromDateKey(end).getTime() - fromDateKey(s).getTime()) / 86400000) + 1)
  }, [start, days, isMonth, months])
  const visible = useMemo(
    () =>
      shifts.filter(
        (s) =>
          range.includes(s.date) &&
          (!position || s.position === position) &&
          (employeeFilter.size === 0 || (s.employeeId !== null && employeeFilter.has(s.employeeId))),
      ),
    [shifts, range, position, employeeFilter],
  )
  /** Positions that have a shift in the displayed range (filter chips). */
  const scheduledPositions = useMemo(() => {
    const used = new Set(shifts.filter((s) => range.includes(s.date)).map((s) => s.position))
    return POSITIONS.filter((p) => used.has(p) || p === position)
  }, [shifts, range, position])
  /** Employees with a shift in the displayed range (admin filter chips). */
  const scheduledEmployees = useMemo(() => {
    const ids = new Set(
      shifts.filter((s) => range.includes(s.date) && (!position || s.position === position)).map((s) => s.employeeId),
    )
    return employees.filter((e) => e.id !== me?.id && ids.has(e.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [shifts, range, position, employees, me])
  const offeredShiftIds = useMemo(
    () => new Set(offers.filter((o) => o.status === 'open').map((o) => o.shiftId)),
    [offers],
  )

  const step = (dir: 1 | -1) => {
    if (isMonth) jumpToMonth(addMonths(visibleMonth, dir))
    else setStart(addDays(start, dir * days))
  }
  const goToday = () => {
    if (isMonth) jumpToMonth(monthKey(todayKey()))
    else setStart(todayKey())
  }
  const changeView = (v: 'week' | 'month') => {
    setView(v)
    if (v === 'month') jumpToMonth(monthKey(start))
  }
  const openDay = (d: string) => {
    setView('week')
    setDays(1)
    setStart(d)
  }

  const openShift = (shift: Shift) => (isAdmin ? setDraft({ ...shift }) : setDetail(shift))

  const first = fromDateKey(range[0])
  const last = fromDateKey(range[range.length - 1])
  const title = isMonth
    ? formatMonth(visibleMonth)
    : days === 1
      ? formatDateLong(range[0])
      : `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(
          undefined,
          {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          },
        )}`

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle={title}
        actions={
          isAdmin && (
            <>
              {!isMonth && (
                <button
                  className="btn-secondary"
                  onClick={() => setCopying(startOfWeek(range[0]))}
                  title="Copy this week's shifts to another week"
                >
                  <Copy size={16} /> Copy week
                </button>
              )}
              <button
                className="btn-primary"
                onClick={() => setDraft({ date: range[0], position: position || 'Server' })}
              >
                <Plus size={16} /> Shift
              </button>
            </>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button className="btn-secondary px-2" onClick={() => step(-1)} aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
          <button className="btn-secondary" onClick={goToday}>
            Today
          </button>
          <button className="btn-secondary px-2" onClick={() => step(1)} aria-label="Next">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm">
          {(['week', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => changeView(v)}
              className={`px-2.5 py-1.5 capitalize ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {v}
            </button>
          ))}
        </div>

        {!isMonth && (
          <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setDays(n)}
                className={`px-2.5 py-1.5 ${days === n ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {n}
              </button>
            ))}
            <span className="hidden self-center px-2 text-xs text-slate-500 sm:inline">days</span>
          </div>
        )}

        {isDesktop && !isMonth && days > 1 && (
          <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm">
            {(['timeline', 'list'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                aria-pressed={layout === l}
                className={`px-2.5 py-1.5 capitalize ${layout === l ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <FilterChip active={!position} onClick={() => setPosition('')}>
          All positions
        </FilterChip>
        {scheduledPositions.map((p) => (
          <FilterChip key={p} active={position === p} onClick={() => setPosition(position === p ? '' : p)}>
            {p}
          </FilterChip>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <FilterChip active={employeeFilter.size === 0} onClick={() => setEmployeeFilter(new Set())}>
          Everyone
        </FilterChip>
        {me && (
          <FilterChip active={employeeFilter.has(me.id)} color={me.color} onClick={() => toggleEmployee(me.id)}>
            Just me
          </FilterChip>
        )}
        {isAdmin &&
          scheduledEmployees.map((e) => (
            <FilterChip
              key={e.id}
              active={employeeFilter.has(e.id)}
              color={e.color}
              onClick={() => toggleEmployee(e.id)}
            >
              {e.name.split(' ')[0]}
            </FilterChip>
          ))}
      </div>

      {isDesktop && isMonth ? (
        <MonthGrid
          months={months}
          onNeedBefore={needBefore}
          onNeedAfter={needAfter}
          onVisibleMonth={setVisibleMonth}
          scrollTarget={scrollTarget}
          shifts={visible}
          employees={employees}
          hideNames={employeeFilter.size === 1}
          highlightEmployeeId={me?.id}
          offeredShiftIds={offeredShiftIds}
          onShiftClick={openShift}
          onDayClick={openDay}
          onAddClick={isAdmin ? (d) => setDraft({ position: position || 'Server', ...d }) : undefined}
          onQuickAdd={isAdmin ? createShift : undefined}
          onMoveShift={isAdmin ? moveShift : undefined}
          onCopyWeek={isAdmin ? setCopying : undefined}
          defaultPosition={position || 'Server'}
        />
      ) : (isDesktop && days > 1 && layout === 'list') || (!isDesktop && (isMonth || days > 1)) ? (
        <DayList
          days={range}
          stacked={!isDesktop}
          shifts={visible}
          employees={employees}
          hideNames={employeeFilter.size === 1}
          highlightEmployeeId={me?.id}
          offeredShiftIds={offeredShiftIds}
          onShiftClick={openShift}
          onDayClick={isDesktop ? openDay : undefined}
          onAddClick={isAdmin ? (d) => setDraft({ position: position || 'Server', ...d }) : undefined}
          onQuickAdd={isAdmin ? createShift : undefined}
          onMoveShift={isAdmin && isDesktop ? moveShift : undefined}
          defaultPosition={position || 'Server'}
        />
      ) : isDesktop ? (
        <TimelineGrid
          days={range}
          shifts={visible}
          hideNames={employeeFilter.size === 1}
          employees={employees}
          highlightEmployeeId={me?.id}
          offeredShiftIds={offeredShiftIds}
          onShiftClick={openShift}
          onSlotClick={
            isAdmin
              ? (date, startMin) =>
                  setDraft({
                    date,
                    startMin,
                    endMin: Math.min(startMin + 300, 23 * 60),
                    position: position || 'Server',
                  })
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {range.map((d) => {
            const dayShifts = visible
              .filter((s) => s.date === d)
              .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
            const isToday = d === todayKey()
            return (
              <section key={d}>
                <h3
                  className={`mb-1.5 flex items-center gap-2 text-sm font-semibold ${isToday ? 'text-slate-900' : 'text-slate-600'}`}
                >
                  {formatDateLong(d)}
                  {isToday && <span className="chip bg-slate-900 text-white">Today</span>}
                  <span className="ml-auto text-xs font-normal text-slate-400">{dayShifts.length} shifts</span>
                </h3>
                {dayShifts.length === 0 ? (
                  <EmptyState title="Nothing scheduled" />
                ) : (
                  <div className="space-y-1.5">
                    {dayShifts.map((s) => (
                      <ShiftRow
                        key={s.id}
                        shift={s}
                        employee={employeeById(s.employeeId)}
                        onClick={() => openShift(s)}
                        trailing={
                          offeredShiftIds.has(s.id) ? (
                            <span className="chip bg-amber-100 text-amber-800">trade</span>
                          ) : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {draft && <ShiftModal draft={draft} onClose={() => setDraft(null)} />}
      {detail && <ShiftDetailModal shift={detail} onClose={() => setDetail(null)} />}
      {copying && <CopyWeekModal sourceStart={copying} onClose={() => setCopying(null)} onDone={finishCopy} />}
      {lastCopy && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          Copied {lastCopy.created.length} shift{lastCopy.created.length === 1 ? '' : 's'}
          {lastCopy.removed.length > 0 && `, replaced ${lastCopy.removed.length}`}
          <button className="font-semibold text-amber-300 hover:text-amber-200" onClick={undoCopy} disabled={undoing}>
            {undoing ? 'Undoing…' : 'Undo'}
          </button>
          <button className="text-slate-400 hover:text-white" onClick={() => setLastCopy(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  )
}
