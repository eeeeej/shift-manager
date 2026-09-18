import { useState } from 'react'
import { useData } from '../data/DataContext'
import { minToTimeInput, timeInputToMin, todayKey } from '../utils/time'
import { ErrorText, Modal, WarnText } from './ui'

/** Staff (or a manager on someone's behalf): ask for time off on any date(s). */
export function TimeOffModal({ onClose }: { onClose: () => void }) {
  const { me, isAdmin, employees, shifts, createTimeOff } = useData()
  const [employeeId, setEmployeeId] = useState(me?.id ?? '')
  const [startDate, setStartDate] = useState(todayKey())
  const [endDate, setEndDate] = useState(todayKey())
  const [partial, setPartial] = useState(false)
  const [startMin, setStartMin] = useState(10 * 60)
  const [endMin, setEndMin] = useState(16 * 60)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const end = endDate < startDate ? startDate : endDate
  const existing = shifts.filter(
    (s) =>
      s.employeeId === employeeId &&
      s.date >= startDate &&
      s.date <= end &&
      (!partial || (s.startMin < endMin && startMin < s.endMin)),
  )

  const submit = async () => {
    if (!employeeId) return setError('Pick who this is for.')
    if (partial && endMin <= startMin) return setError('End time must be after start time.')
    setBusy(true)
    setError(null)
    try {
      await createTimeOff({
        employeeId,
        startDate,
        endDate: end,
        startMin: partial ? startMin : null,
        endMin: partial ? endMin : null,
        note: note.trim() || null,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Request time off"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            Send request
          </button>
        </>
      }
    >
      {isAdmin && (
        <div className="mb-3">
          <label className="label">For</label>
          <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Choose…</option>
            {employees
              .filter((e) => e.active)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.id === me?.id ? ' (me)' : ''}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              if (endDate < e.target.value) setEndDate(e.target.value)
            }}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={end} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
        Only part of the day
      </label>
      {partial && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start</label>
            <input type="time" className="input" value={minToTimeInput(startMin)} onChange={(e) => setStartMin(timeInputToMin(e.target.value))} />
          </div>
          <div>
            <label className="label">End</label>
            <input type="time" className="input" value={minToTimeInput(endMin)} onChange={(e) => setEndMin(timeInputToMin(e.target.value))} />
          </div>
        </div>
      )}
      <div className="mt-3">
        <label className="label">Note (optional)</label>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Out of town, doctor's appointment…" />
      </div>
      {existing.length > 0 && (
        <WarnText className="mt-3">
          {employeeId === me?.id ? "You're" : `${employees.find((e) => e.id === employeeId)?.name ?? 'They'} is`} already scheduled for{' '}
          {existing.length === 1 ? 'a shift' : `${existing.length} shifts`} in this period. The manager will see that when deciding.
        </WarnText>
      )}
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
