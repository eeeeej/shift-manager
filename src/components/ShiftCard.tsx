import type { ReactNode } from 'react'
import type { Employee, Shift } from '../types'
import { shiftColor, withAlpha } from '../utils/colors'
import { formatDuration, formatRange } from '../utils/time'
import { Avatar } from './ui'

/** Absolutely-positioned card for the timeline grid. */
export function TimelineShift({
  shift,
  employee,
  compact,
  highlighted,
  hasOpenOffer,
  onClick,
}: {
  shift: Shift
  employee: Employee | undefined
  compact: boolean
  highlighted?: boolean
  hasOpenOffer?: boolean
  onClick?: () => void
}) {
  const color = shiftColor(shift, employee)
  const isOpen = shift.status === 'open' || !employee
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group absolute flex h-full w-full flex-col overflow-hidden rounded-md border-l-[3px] text-left text-xs leading-tight shadow-sm transition hover:z-20 hover:shadow-md ${
        isOpen ? 'border-dashed' : ''
      } ${highlighted ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
      style={{
        borderLeftColor: isOpen ? '#f59e0b' : color,
        backgroundColor: isOpen ? withAlpha('#f59e0b', 0.15) : withAlpha(color, 0.16),
        padding: compact ? '2px 4px' : '4px 6px',
      }}
      title={`${employee?.name ?? 'Open shift'} · ${formatRange(shift.startMin, shift.endMin)}${shift.notes ? ` · ${shift.notes}` : ''}`}
    >
      <span className="truncate font-semibold text-slate-900">{employee?.name ?? 'OPEN'}</span>
      <span className="truncate text-slate-600">{formatRange(shift.startMin, shift.endMin, compact)}</span>
      {!compact && shift.notes && <span className="truncate text-slate-500">{shift.notes}</span>}
      {hasOpenOffer && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" title="Up for trade" />
      )}
    </button>
  )
}

/** Row-style card for lists (dashboard, mobile day view). */
export function ShiftRow({
  shift,
  employee,
  onClick,
  trailing,
  showDate,
}: {
  shift: Shift
  employee: Employee | undefined
  onClick?: () => void
  trailing?: ReactNode
  showDate?: string
}) {
  const color = shiftColor(shift, employee)
  const isOpen = shift.status === 'open' || !employee
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left ${
        onClick ? 'hover:bg-slate-50' : ''
      }`}
      style={{ borderLeft: `4px solid ${isOpen ? '#f59e0b' : color}` }}
    >
      {employee ? (
        <Avatar name={employee.name} color={color} size="sm" />
      ) : (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">?</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">{employee?.name ?? 'Open shift'}</span>
          <span className="text-xs text-slate-500">{shift.position}</span>
        </div>
        <div className="text-xs text-slate-600">
          {showDate && <span className="mr-1.5">{showDate} ·</span>}
          {formatRange(shift.startMin, shift.endMin)}
          <span className="text-slate-400"> · {formatDuration(shift.startMin, shift.endMin)}</span>
          {shift.notes && <span className="text-slate-400"> · {shift.notes}</span>}
        </div>
      </div>
      {trailing}
    </Wrapper>
  )
}
