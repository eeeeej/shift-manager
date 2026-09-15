import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useData } from '../data/DataContext'
import { POSITIONS, type Position, type ShiftInput } from '../types'
import { conflictMessage, confirmOverlap, findConflicts } from '../utils/conflicts'
import { CLOSE_MIN, minToTimeInput, parseShorthand, timeInputToMin } from '../utils/time'
import { ErrorText, Modal, WarnText } from './ui'

export type ShiftDraft = Partial<ShiftInput> & { id?: string }

export function ShiftModal({ draft, onClose }: { draft: ShiftDraft; onClose: () => void }) {
  const { employees, shifts, createShift, updateShift, deleteShift } = useData()
  const [employeeId, setEmployeeId] = useState<string>(draft.employeeId ?? '')
  const [position, setPosition] = useState<Position>(draft.position ?? 'Server')
  const [date, setDate] = useState(draft.date ?? '')
  const [start, setStart] = useState(minToTimeInput(draft.startMin ?? 16 * 60))
  const [end, setEnd] = useState(minToTimeInput(draft.endMin ?? 21 * 60))
  const [notes, setNotes] = useState(draft.notes ?? '')
  const [color, setColor] = useState(draft.color ?? '')
  const [shorthand, setShorthand] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isEdit = !!draft.id
  const active = employees.filter((e) => e.active || e.id === employeeId)
  const eligible = active.filter((e) => e.positions.includes(position))
  const chosen = employees.find((e) => e.id === employeeId)
  const conflicts = findConflicts(
    shifts,
    employeeId,
    { date, startMin: timeInputToMin(start), endMin: timeInputToMin(end) },
    draft.id,
  )

  const applyShorthand = (text: string) => {
    setShorthand(text)
    const parsed = parseShorthand(text)
    if (parsed) {
      setStart(minToTimeInput(parsed.startMin))
      setEnd(minToTimeInput(Math.min(parsed.endMin, CLOSE_MIN)))
    }
  }

  const save = async () => {
    setError(null)
    const startMin = timeInputToMin(start)
    const endMin = timeInputToMin(end)
    if (!date) return setError('Pick a date')
    if (endMin <= startMin) return setError('End time must be after start time')
    if (!confirmOverlap(conflicts, chosen?.name)) return
    const input: ShiftInput = {
      employeeId: employeeId || null,
      position,
      date,
      startMin,
      endMin,
      notes: notes.trim() || null,
      status: employeeId ? 'scheduled' : 'open',
      color: color || null,
    }
    setBusy(true)
    try {
      if (isEdit) await updateShift(draft.id!, input)
      else await createShift(input)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!isEdit || !confirm('Delete this shift?')) return
    setBusy(true)
    try {
      await deleteShift(draft.id!)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit shift' : 'New shift'}
      onClose={onClose}
      footer={
        <>
          {isEdit && (
            <button className="btn-ghost mr-auto text-red-600" onClick={remove} disabled={busy}>
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {isEdit ? 'Save' : 'Create'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Position</label>
          <select className="input" value={position} onChange={(e) => setPosition(e.target.value as Position)}>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Employee</label>
          <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">— Open shift —</option>
            {eligible.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
            {active.some((e) => !e.positions.includes(position)) && (
              <optgroup label="Other positions">
                {active
                  .filter((e) => !e.positions.includes(position))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
          <WarnText className="mt-2">{conflictMessage(conflicts, chosen?.name)}</WarnText>
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Quick entry</label>
          <input
            className="input"
            placeholder="e.g. 10-4, 4:40-CL, 5-9"
            value={shorthand}
            onChange={(e) => applyShorthand(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Start</label>
          <input type="time" step={300} className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">End</label>
          <input type="time" step={300} className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="BB, section, training…" />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <label className="label mb-0">Color override</label>
          <input type="color" value={color || '#94a3b8'} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-slate-300" />
          {color && (
            <button className="btn-ghost text-xs" onClick={() => setColor('')}>
              Use employee color
            </button>
          )}
        </div>
      </div>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
