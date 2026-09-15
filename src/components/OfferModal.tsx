import { useState } from 'react'
import { useData } from '../data/DataContext'
import type { Shift } from '../types'
import { conflictMessage, confirmOverlap, findConflicts } from '../utils/conflicts'
import { formatDateLong, formatRange } from '../utils/time'
import { ShiftRow } from './ShiftCard'
import { ErrorText, Modal, WarnText } from './ui'

/** Employee: put one of your shifts up for trade. */
export function OfferModal({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { me, employees, employeeById, createOffer } = useData()
  const [target, setTarget] = useState<string>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const coworkers = employees.filter((e) => e.id !== me?.id && e.active && e.positions.includes(shift.position))

  const submit = async () => {
    if (!me) return
    setBusy(true)
    setError(null)
    try {
      await createOffer({ shiftId: shift.id, offeredBy: me.id, targetEmployeeId: target || null, message: message.trim() || null })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Offer shift for trade"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            Post offer
          </button>
        </>
      }
    >
      <p className="mb-2 text-sm text-slate-600">
        {formatDateLong(shift.date)} · {formatRange(shift.startMin, shift.endMin)}
      </p>
      <ShiftRow shift={shift} employee={employeeById(shift.employeeId)} />
      <div className="mt-4">
        <label className="label">Send to</label>
        <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Everyone who works {shift.position}</option>
          {coworkers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {target ? 'Only this coworker (and admins) will see the offer.' : `Any ${shift.position} can claim it in one tap.`}
        </p>
      </div>
      <div className="mt-3">
        <label className="label">Message (optional)</label>
        <textarea className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anyone able to cover?" />
      </div>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}

/** Admin: reassign a shift directly. */
export function ReassignModal({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { employees, employeeById, shifts, updateShift, offers, cancelOffer } = useData()
  const [employeeId, setEmployeeId] = useState(shift.employeeId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const conflicts = findConflicts(shifts, employeeId, shift, shift.id)
  const chosen = employeeId ? employeeById(employeeId) : undefined

  const submit = async () => {
    if (!confirmOverlap(conflicts, chosen?.name)) return
    setBusy(true)
    setError(null)
    try {
      await updateShift(shift.id, { employeeId: employeeId || null, status: employeeId ? 'scheduled' : 'open' })
      for (const o of offers) if (o.shiftId === shift.id && o.status === 'open') await cancelOffer(o.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Reassign shift"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            Reassign
          </button>
        </>
      }
    >
      <ShiftRow shift={shift} employee={employeeById(shift.employeeId)} showDate={formatDateLong(shift.date)} />
      <div className="mt-4">
        <label className="label">Assign to</label>
        <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">— Leave open —</option>
          {employees
            .filter((e) => e.active)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.positions.includes(shift.position) ? '' : ` (not ${shift.position})`}
              </option>
            ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">Any open offers on this shift will be cancelled.</p>
        <WarnText className="mt-2">{conflictMessage(conflicts, chosen?.name)}</WarnText>
      </div>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
