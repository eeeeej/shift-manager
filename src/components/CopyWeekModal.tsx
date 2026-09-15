import { useState } from 'react'
import { useData } from '../data/DataContext'
import type { Shift, ShiftInput } from '../types'
import { addDays, dateRange, fromDateKey, startOfWeek } from '../utils/time'
import { ErrorText, Modal } from './ui'

/** Everything needed to reverse a copy: shifts we inserted and shifts we replaced. */
export interface CopyResult {
  created: Shift[]
  removed: Shift[]
  targetStart: string
}

type Conflict = 'skip' | 'overwrite'

const weekLabel = (start: string) => {
  const a = fromDateKey(start)
  const b = fromDateKey(addDays(start, 6))
  return `${a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`
}

export function CopyWeekModal({
  sourceStart,
  onClose,
  onDone,
}: {
  /** Sunday of the week being copied. */
  sourceStart: string
  onClose: () => void
  onDone: (result: CopyResult) => void
}) {
  const { shifts, createShifts, deleteShifts } = useData()
  const [targetStart, setTargetStart] = useState(addDays(sourceStart, 7))
  const [weeks, setWeeks] = useState(1)
  const [conflict, setConflict] = useState<Conflict>('skip')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sourceDays = dateRange(sourceStart, 7)
  const source = shifts.filter((s) => sourceDays.includes(s.date))
  const targets = Array.from({ length: weeks }, (_, i) => addDays(targetStart, i * 7))
  const targetDays = new Set(targets.flatMap((t) => dateRange(t, 7)))
  const existing = shifts.filter((s) => targetDays.has(s.date))
  const busyDays = new Set(existing.map((s) => s.date))

  const plan = (() => {
    const inputs: ShiftInput[] = []
    for (const t of targets) {
      const offset = Math.round((fromDateKey(t).getTime() - fromDateKey(sourceStart).getTime()) / 86400000)
      for (const s of source) {
        const date = addDays(s.date, offset)
        if (conflict === 'skip' && busyDays.has(date)) continue
        inputs.push({
          employeeId: s.employeeId,
          position: s.position,
          date,
          startMin: s.startMin,
          endMin: s.endMin,
          notes: s.notes,
          status: s.employeeId ? 'scheduled' : 'open',
          color: s.color,
        })
      }
    }
    return inputs
  })()
  const removed = conflict === 'overwrite' ? existing : []

  const copy = async () => {
    setError(null)
    if (targetDays.has(sourceStart)) return setError('Target overlaps the source week')
    setBusy(true)
    try {
      if (removed.length) await deleteShifts(removed.map((s) => s.id))
      const created = await createShifts(plan)
      onDone({ created, removed, targetStart })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Copy week of ${weekLabel(sourceStart)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={copy} disabled={busy || plan.length === 0}>
            {busy ? 'Copying…' : `Copy ${plan.length} shift${plan.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          {source.length} shift{source.length === 1 ? '' : 's'} in the source week. Offers aren't copied; every copy
          starts fresh.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Paste into week of</span>
            <input
              type="date"
              className="input"
              value={targetStart}
              onChange={(e) => e.target.value && setTargetStart(startOfWeek(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Repeat for</span>
            <select className="input" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              {[1, 2, 3, 4, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n} week{n === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          {targets.length === 1
            ? `Week of ${weekLabel(targets[0])}`
            : `${weekLabel(targets[0])} through ${weekLabel(targets[targets.length - 1])}`}
        </p>

        {existing.length > 0 && (
          <fieldset className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <legend className="px-1 text-xs font-medium text-amber-800">
              {existing.length} shift{existing.length === 1 ? '' : 's'} already scheduled on {busyDays.size} of those
              days
            </legend>
            {(
              [
                ['skip', 'Skip days that already have shifts'],
                ['overwrite', 'Replace them with the copied shifts'],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="conflict" checked={conflict === v} onChange={() => setConflict(v)} />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
