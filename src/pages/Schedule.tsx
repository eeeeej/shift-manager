import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ShiftRow } from '../components/ShiftCard'
import { ShiftDetailModal } from '../components/ShiftDetailModal'
import { ShiftModal, type ShiftDraft } from '../components/ShiftModal'
import { MonthGrid, monthRange } from '../components/MonthGrid'
import { TimelineGrid } from '../components/TimelineGrid'
import { EmptyState, PageHeader } from '../components/ui'
import { useData } from '../data/DataContext'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { POSITIONS, type Position, type Shift } from '../types'
import { addDays, dateRange, formatDateLong, fromDateKey, startOfWeek, toDateKey, todayKey } from '../utils/time'

export function Schedule() {
  const { shifts, employees, offers, isAdmin, me, employeeById } = useData()
  const isDesktop = useIsDesktop()
  const [view, setView] = useState<'week' | 'month'>('week')
  const [days, setDays] = useState(7)
  const [start, setStart] = useState(() => startOfWeek(todayKey()))
  const isMonth = view === 'month'
  const [position, setPosition] = useState<Position | ''>('')
  const [employeeFilter, setEmployeeFilter] = useState<string>('')
  const [draft, setDraft] = useState<ShiftDraft | null>(null)
  const [detail, setDetail] = useState<Shift | null>(null)

  const range = useMemo(() => {
    if (!isMonth) return dateRange(start, days)
    const { start: s, end } = monthRange(start)
    return dateRange(s, fromDateKey(end).getDate())
  }, [start, days, isMonth])
  const visible = useMemo(
    () =>
      shifts.filter(
        (s) =>
          range.includes(s.date) &&
          (!position || s.position === position) &&
          (!employeeFilter || s.employeeId === employeeFilter),
      ),
    [shifts, range, position, employeeFilter],
  )
  const offeredShiftIds = useMemo(
    () => new Set(offers.filter((o) => o.status === 'open').map((o) => o.shiftId)),
    [offers],
  )

  const step = (dir: 1 | -1) => {
    if (isMonth) {
      const d = fromDateKey(start)
      setStart(toDateKey(new Date(d.getFullYear(), d.getMonth() + dir, 1)))
    } else setStart(addDays(start, dir * days))
  }
  const goToday = () => setStart(isMonth || days !== 7 ? todayKey() : startOfWeek(todayKey()))
  const changeView = (v: 'week' | 'month') => {
    setView(v)
    if (v === 'week') setStart(days === 7 ? startOfWeek(start) : start)
  }
  const openDay = (d: string) => {
    setView('week')
    setDays(1)
    setStart(d)
  }
  const changeDays = (n: number) => {
    setDays(n)
    setStart(n === 7 ? startOfWeek(start) : start)
  }

  const openShift = (shift: Shift) => (isAdmin ? setDraft({ ...shift }) : setDetail(shift))

  const first = fromDateKey(range[0])
  const last = fromDateKey(range[range.length - 1])
  const title = isMonth
    ? first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
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
            <button
              className="btn-primary"
              onClick={() => setDraft({ date: range[0], position: position || 'Server' })}
            >
              <Plus size={16} /> Shift
            </button>
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
                onClick={() => changeDays(n)}
                className={`px-2.5 py-1.5 ${days === n ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {n}
              </button>
            ))}
            <span className="hidden self-center px-2 text-xs text-slate-500 sm:inline">days</span>
          </div>
        )}

        <select
          className="input w-auto"
          value={position}
          onChange={(e) => setPosition(e.target.value as Position | '')}
        >
          <option value="">All positions</option>
          {POSITIONS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <select className="input w-auto" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
          <option value="">Everyone</option>
          {me && <option value={me.id}>Just me</option>}
          {employees
            .filter((e) => e.active && e.id !== me?.id)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </div>

      {isDesktop && isMonth ? (
        <MonthGrid
          month={start}
          shifts={visible}
          employees={employees}
          hideNames={!!employeeFilter}
          highlightEmployeeId={me?.id}
          offeredShiftIds={offeredShiftIds}
          onShiftClick={openShift}
          onDayClick={openDay}
          onAddClick={isAdmin ? (date) => setDraft({ date, position: position || 'Server' }) : undefined}
        />
      ) : isDesktop ? (
        <TimelineGrid
          days={range}
          shifts={visible}
          hideNames={!!employeeFilter}
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
    </div>
  )
}
