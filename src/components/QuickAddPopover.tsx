import { useEffect, useRef, useState } from 'react'
import { useData } from '../data/DataContext'
import type { Employee, Position, ShiftInput } from '../types'
import { conflictMessage, confirmOverlap, findConflicts } from '../utils/conflicts'
import { CLOSE_MIN, formatDateShort, formatShorthand, parseShorthand } from '../utils/time'
import { WarnText } from './ui'

/** Common spreadsheet shifts, as [startMin, endMin]. */
const PRESETS: [number, number][] = [
  [10 * 60, 16 * 60],
  [11 * 60, 14 * 60],
  [16 * 60, 21 * 60],
  [16 * 60, CLOSE_MIN],
]

export function QuickAddPopover({
  date,
  employees,
  defaultPosition,
  onSubmit,
  onMore,
  onClose,
}: {
  date: string
  employees: Employee[]
  defaultPosition: Position
  onSubmit: (input: ShiftInput) => Promise<void>
  /** Open the full shift editor with whatever has been entered so far. */
  onMore: (draft: Partial<ShiftInput>) => void
  onClose: () => void
}) {
  const { shifts, positions } = useData()
  const [employeeId, setEmployeeId] = useState('')
  const [position, setPosition] = useState<Position>(defaultPosition)
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const emp = employees.find((e) => e.id === employeeId)
  const candidates = employees
    .filter((e) => e.active && e.positions.includes(position))
    .sort((a, b) => a.name.localeCompare(b.name))
  const parsed = parseShorthand(time)
  const dayConflicts = findConflicts(shifts, employeeId, { date, startMin: 0, endMin: 0 })

  const draft = (): Partial<ShiftInput> => ({
    date,
    position,
    employeeId: employeeId || null,
    ...(parsed ?? {}),
  })

  const submit = async (range: { startMin: number; endMin: number } | null) => {
    if (!range) {
      setError('Enter a time like 10-4 or 4-CL')
      return
    }
    if (!confirmOverlap(findConflicts(shifts, employeeId, { date, ...range }), emp?.name)) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        date,
        position,
        employeeId: employeeId || null,
        startMin: range.startMin,
        endMin: range.endMin,
        notes: null,
        status: employeeId ? 'scheduled' : 'open',
        color: null,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add shift')
      setBusy(false)
    }
  }

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`Add shift on ${formatDateShort(date)}`}
      onClick={(e) => e.stopPropagation()}
      className="absolute left-1 top-8 z-20 w-56 cursor-default rounded-lg border border-slate-200 bg-white p-2 text-left text-xs shadow-lg"
    >
      <div className="mb-1.5 font-semibold text-slate-700">{formatDateShort(date)}</div>
      <select
        className="input mb-1.5 w-full py-1 text-xs"
        value={position}
        onChange={(e) => setPosition(e.target.value as Position)}
      >
        {positions.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <select
        className="input mb-1.5 w-full py-1 text-xs"
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        autoFocus
      >
        <option value="">OPEN (unassigned)</option>
        {candidates.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <WarnText className="mb-1.5 !px-2 !py-1 !text-xs">{conflictMessage(dayConflicts, emp?.name)}</WarnText>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {PRESETS.map(([s, e]) => (
          <button
            key={s + '-' + e}
            disabled={busy}
            onClick={() => submit({ startMin: s, endMin: e })}
            className="chip border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-900 hover:text-white"
            style={emp ? { borderColor: emp.color } : undefined}
          >
            {formatShorthand(s, e)}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          submit(parsed)
        }}
      >
        <input
          ref={timeRef}
          className="input w-full py-1 text-xs"
          placeholder="Other, e.g. 11-3"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={busy || !parsed}>
          Add
        </button>
      </form>
      {error && <p className="mt-1 text-red-600">{error}</p>}
      <button className="mt-1.5 text-slate-500 underline-offset-2 hover:underline" onClick={() => onMore(draft())}>
        More options…
      </button>
    </div>
  )
}
