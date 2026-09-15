import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import type { Employee, Position, Shift, ShiftInput } from '../types'
import { shiftColor } from '../utils/colors'
import { formatShorthand } from '../utils/time'
import { QuickAddPopover } from './QuickAddPopover'

/** Short tag shown on chips for non-server roles ("BB" as on the spreadsheet). */
export const POSITION_TAGS: Partial<Record<Position, string>> = {
  'Bar Back': 'BB',
  Bartender: 'BAR',
  Host: 'HOST',
  Busser: 'BUS',
  Kitchen: 'KIT',
  Manager: 'MGR',
}

/** Spreadsheet divider between the day and evening crews. */
export const DIVIDER_MIN = 16 * 60

export interface DayCellCallbacks {
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
  defaultPosition?: Position
}

/** State shared by every cell in one grid: day/evening toggles, open popover, drag source/target. */
export interface DayCellState {
  showDay: boolean
  showEvening: boolean
  toggle: (part: 'day' | 'evening') => void
  quickAdd: string | null
  setQuickAdd: (d: string | null) => void
  dragOver: string | null
  setDragOver: (fn: string | null | ((v: string | null) => string | null)) => void
  /** Chip currently being dragged, if any. */
  getDragging: () => Shift | null
  setDragging: (s: Shift | null) => void
}

export function useDayCellState(): DayCellState {
  const [showDay, setShowDay] = useState(true)
  const [showEvening, setShowEvening] = useState(true)
  const [quickAdd, setQuickAdd] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const dragging = useRef<Shift | null>(null)
  const toggle = (part: 'day' | 'evening') => {
    if (part === 'day') setShowDay((v) => !v || !showEvening)
    else setShowEvening((v) => !v || !showDay)
  }
  const getDragging = () => dragging.current
  const setDragging = (s: Shift | null) => {
    dragging.current = s
  }
  return { showDay, showEvening, toggle, quickAdd, setQuickAdd, dragOver, setDragOver, getDragging, setDragging }
}

export function groupByDay(shifts: Shift[]): Map<string, Shift[]> {
  const m = new Map<string, Shift[]>()
  for (const s of shifts) {
    const list = m.get(s.date) ?? []
    list.push(s)
    m.set(s.date, list)
  }
  for (const list of m.values()) list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  return m
}

export function DayPartToggle({ state }: { state: DayCellState }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs">
      <span className="text-slate-500">Show</span>
      {(
        [
          ['day', 'Day (before 4pm)', state.showDay],
          ['evening', 'Evening (4pm on)', state.showEvening],
        ] as const
      ).map(([part, label, on]) => (
        <button
          key={part}
          aria-pressed={on}
          onClick={() => state.toggle(part)}
          className={`chip border px-2.5 py-1 ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function DayCell({
  date,
  shifts,
  label,
  muted,
  isToday,
  employees,
  state,
  className = '',
  ...cb
}: DayCellCallbacks & {
  date: string
  shifts: Shift[]
  /** Day-number / weekday label shown top-left. */
  label: ReactNode
  /** Outside the current month: greyed, not droppable. */
  muted?: boolean
  isToday: boolean
  employees: Employee[]
  state: DayCellState
  className?: string
}) {
  const {
    hideNames,
    highlightEmployeeId,
    offeredShiftIds,
    onShiftClick,
    onDayClick,
    onAddClick,
    onQuickAdd,
    onMoveShift,
  } = cb
  const defaultPosition = cb.defaultPosition ?? 'Server'
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const { showDay, showEvening, quickAdd, setQuickAdd, dragOver, setDragOver, getDragging, setDragging } = state
  const editable = !!onAddClick
  const dayShifts = muted ? [] : shifts
  const dayPart = showDay ? dayShifts.filter((s) => s.startMin < DIVIDER_MIN) : []
  const eveningPart = showEvening ? dayShifts.filter((s) => s.startMin >= DIVIDER_MIN) : []
  const chip = (s: Shift) => {
    const emp = s.employeeId ? empById.get(s.employeeId) : undefined
    const open = !emp
    const mine = highlightEmployeeId && s.employeeId === highlightEmployeeId
    const text =
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
          setDragging(s)
          e.dataTransfer.effectAllowed = 'copyMove'
          e.dataTransfer.setData('text/plain', s.id)
        }}
        onDragEnd={() => {
          setDragging(null)
          setDragOver(null)
        }}
        onClick={(e) => {
          e.stopPropagation()
          onShiftClick?.(s)
        }}
        className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs leading-4 md:py-px md:text-[11px] ${
          open ? 'border border-dashed border-amber-400 bg-amber-50 text-amber-800' : 'text-slate-800'
        } ${mine ? 'ring-1 ring-slate-900' : ''} ${onMoveShift ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={open ? undefined : { backgroundColor: `${shiftColor(s, emp)}22` }}
      >
        {!open && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: shiftColor(s, emp) }} />}
        <span className="truncate">{open ? `OPEN ${text}` : text}</span>
        {POSITION_TAGS[s.position] && (
          <span className="shrink-0 rounded bg-slate-800/80 px-1 text-[9px] font-semibold leading-3 text-white">
            {POSITION_TAGS[s.position]}
          </span>
        )}
        {offeredShiftIds?.has(s.id) && (
          <ArrowLeftRight className="ml-auto h-3 w-3 shrink-0 text-amber-600" aria-label="Up for trade" />
        )}
      </button>
    )
  }
  const dayCount = dayShifts.filter((s) => s.startMin < DIVIDER_MIN).length
  const eveCount = dayShifts.length - dayCount
  const openCount = dayShifts.filter((s) => !s.employeeId).length
  const droppable = !!onMoveShift && !muted
  return (
    <div
      className={`group relative min-h-[7rem] p-1 ${muted ? 'bg-slate-50/60' : 'bg-white'} ${
        onDayClick ? 'cursor-pointer hover:bg-slate-50' : ''
      } ${dragOver === date ? 'bg-sky-50 ring-2 ring-inset ring-sky-400' : ''} ${className}`}
      onClick={() => onDayClick?.(date)}
      onDragOver={
        droppable
          ? (e) => {
              if (!getDragging()) return
              e.preventDefault()
              e.dataTransfer.dropEffect = e.shiftKey ? 'copy' : 'move'
              if (dragOver !== date) setDragOver(date)
            }
          : undefined
      }
      onDragLeave={droppable ? () => setDragOver((v) => (v === date ? null : v)) : undefined}
      onDrop={
        droppable
          ? (e) => {
              e.preventDefault()
              const s = getDragging()
              setDragging(null)
              setDragOver(null)
              if (!s) return
              const copy = e.shiftKey
              if (s.date === date && !copy) return
              onMoveShift?.(s, date, copy)
            }
          : undefined
      }
    >
      {quickAdd === date && onQuickAdd && onAddClick && (
        <QuickAddPopover
          date={date}
          employees={employees}
          defaultPosition={defaultPosition}
          onSubmit={onQuickAdd}
          onMore={(draft) => {
            setQuickAdd(null)
            onAddClick({ ...draft, date })
          }}
          onClose={() => setQuickAdd(null)}
        />
      )}
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
            isToday ? 'bg-slate-900 text-white' : muted ? 'text-slate-400' : 'text-slate-700'
          }`}
        >
          {label}
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
              className={`rounded px-1 text-slate-500 hover:bg-slate-200 ${quickAdd === date ? 'inline bg-slate-200' : 'inline md:hidden md:group-hover:inline'}`}
              title="Add shift"
              onClick={(e) => {
                e.stopPropagation()
                if (onQuickAdd) setQuickAdd(quickAdd === date ? null : date)
                else onAddClick?.({ date })
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
