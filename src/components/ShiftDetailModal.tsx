import { useState } from 'react'
import { useData } from '../data/DataContext'
import type { Shift } from '../types'
import { formatDateLong, formatDuration, formatRange, todayKey } from '../utils/time'
import { OfferModal } from './OfferModal'
import { Avatar, Modal } from './ui'

/** Read-only shift view for employees, with the "offer for trade" action on their own shifts. */
export function ShiftDetailModal({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { me, employeeById, offers, cancelOffer } = useData()
  const [offering, setOffering] = useState(false)
  const employee = employeeById(shift.employeeId)
  const mine = !!me && shift.employeeId === me.id
  const openOffer = offers.find((o) => o.shiftId === shift.id && o.status === 'open')
  const inFuture = shift.date >= todayKey()

  if (offering) return <OfferModal shift={shift} onClose={onClose} />

  return (
    <Modal
      title="Shift"
      onClose={onClose}
      footer={
        mine && inFuture ? (
          openOffer ? (
            <button className="btn-secondary" onClick={() => cancelOffer(openOffer.id).then(onClose)}>
              Cancel my offer
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setOffering(true)}>
              Offer for trade
            </button>
          )
        ) : (
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      <div className="flex items-center gap-3">
        {employee ? (
          <Avatar name={employee.name} color={shift.color ?? employee.color} />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 font-bold text-amber-700">?</span>
        )}
        <div>
          <div className="font-semibold">{employee?.name ?? 'Open shift'}</div>
          <div className="text-sm text-slate-500">{shift.position}</div>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-slate-500">Date</dt>
        <dd>{formatDateLong(shift.date)}</dd>
        <dt className="text-slate-500">Time</dt>
        <dd>
          {formatRange(shift.startMin, shift.endMin)} <span className="text-slate-400">({formatDuration(shift.startMin, shift.endMin)})</span>
        </dd>
        {shift.notes && (
          <>
            <dt className="text-slate-500">Notes</dt>
            <dd>{shift.notes}</dd>
          </>
        )}
        {openOffer && (
          <>
            <dt className="text-slate-500">Trade</dt>
            <dd className="text-amber-700">
              Up for trade{openOffer.targetEmployeeId ? ` (sent to ${employeeById(openOffer.targetEmployeeId)?.name ?? 'a coworker'})` : ' (broadcast)'}
            </dd>
          </>
        )}
      </dl>
    </Modal>
  )
}
