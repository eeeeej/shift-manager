import { useState } from 'react'
import { useData } from '../data/DataContext'
import type { TimeOffRequest } from '../types'
import { formatDateShort, formatRange, formatStamp } from '../utils/time'
import { describeDates, describeWindow, shiftsDuring } from '../utils/timeOff'
import { Avatar, ErrorText, WarnText } from './ui'

const STATUS_CHIP: Record<TimeOffRequest['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

export function TimeOffCard({ request }: { request: TimeOffRequest }) {
  const { employeeById, shifts, me, isAdmin, setTimeOffStatus } = useData()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const who = employeeById(request.employeeId)
  const mine = who?.id === me?.id
  const conflicts = shiftsDuring(shifts, request)
  const pending = request.status === 'pending'

  const decide = async (status: 'approved' | 'denied' | 'cancelled') => {
    if (status === 'approved' && conflicts.length > 0) {
      const list = conflicts.map((s) => `${formatDateShort(s.date)} ${s.position} ${formatRange(s.startMin, s.endMin, true)}`).join(', ')
      if (!confirm(`${who?.name ?? 'This person'} is scheduled for ${list}. Approve anyway? (The shift stays on the schedule until you change it.)`)) return
    }
    if (status === 'cancelled' && !confirm('Withdraw this request?')) return
    setBusy(true)
    setError(null)
    try {
      await setTimeOffStatus(request.id, status, note.trim() || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`card p-4 ${!pending && request.status !== 'approved' ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {who && <Avatar name={who.name} color={who.color} />}
          <div>
            <div className="text-base sm:text-sm">
              <span className="font-semibold">{mine ? 'You' : (who?.name ?? 'Unknown')}</span>
              <span className="text-slate-500"> {request.status === 'approved' ? 'off' : 'requested'}</span>
            </div>
            <div className="text-base font-medium sm:text-sm">
              {describeDates(request)}
              <span className="ml-1.5 text-sm font-normal text-slate-500 sm:text-xs">{describeWindow(request)}</span>
            </div>
          </div>
        </div>
        <span className={`chip ${STATUS_CHIP[request.status]}`}>{request.status}</span>
      </div>

      <div className="mt-1 text-xs text-slate-400">
        Requested {formatStamp(request.createdAt)}
        {request.decidedAt && request.status !== 'pending' && <span> · {request.status === 'approved' ? 'Approved' : 'Denied'} {formatStamp(request.decidedAt)}</span>}
      </div>
      {request.note && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-base text-slate-700 sm:text-sm">“{request.note}”</p>}
      {request.decisionNote && (
        <p className="mt-2 text-sm text-slate-600">
          <span className="text-slate-400">Manager:</span> {request.decisionNote}
        </p>
      )}

      {isAdmin && pending && conflicts.length > 0 && (
        <WarnText className="mt-3">
          Already scheduled: {conflicts.map((s) => `${formatDateShort(s.date)} ${formatRange(s.startMin, s.endMin, true)}`).join(', ')}
        </WarnText>
      )}

      {pending && isAdmin && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input className="input flex-1" placeholder="Note back (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={busy} onClick={() => decide('denied')}>
              Deny
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => decide('approved')}>
              Approve
            </button>
          </div>
        </div>
      )}
      {pending && !isAdmin && mine && (
        <div className="mt-3 flex justify-end">
          <button className="btn-secondary" disabled={busy} onClick={() => decide('cancelled')}>
            Withdraw
          </button>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </div>
  )
}
