import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { OfferCard } from '../components/OfferCard'
import { OfferModal } from '../components/OfferModal'
import { ShiftRow } from '../components/ShiftCard'
import { EmptyState, Modal } from '../components/ui'
import { useData } from '../data/DataContext'
import { visibleOffersFor } from '../data/offers'
import type { Shift } from '../types'
import { formatDateShort, todayKey } from '../utils/time'

type Tab = 'open' | 'mine' | 'history'

/** "Shift offers" tab of the Requests page. */
export function OffersSection() {
  const { offers, shifts, me, isAdmin, employeeById } = useData()
  const [tab, setTab] = useState<Tab>('open')
  const [picking, setPicking] = useState(false)
  const [offering, setOffering] = useState<Shift | null>(null)

  const visible = useMemo(() => visibleOffersFor(offers, shifts, me, isAdmin), [offers, shifts, me, isAdmin])
  const sorted = [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const lists: Record<Tab, typeof sorted> = {
    open: sorted.filter((o) => o.status === 'open' && (isAdmin || o.offeredBy !== me?.id)),
    mine: sorted.filter((o) => me && (o.offeredBy === me.id || o.claimedBy === me.id)),
    history: sorted.filter((o) => o.status !== 'open'),
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'open', label: isAdmin ? 'Open' : 'Available' },
    ...(me ? [{ key: 'mine' as Tab, label: 'Mine' }] : []),
    { key: 'history', label: 'History' },
  ]

  const myFutureShifts = me
    ? shifts
        .filter((s) => s.employeeId === me.id && s.date >= todayKey() && !offers.some((o) => o.shiftId === s.id && o.status === 'open'))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
    : []

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{isAdmin ? 'Every trade across the team' : 'Trade shifts with coworkers who share your position'}</p>
        {me && (
          <button className="btn-primary flex-shrink-0" onClick={() => setPicking(true)}>
            <Plus size={16} /> Offer a shift
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-slate-400">{lists[t.key].length}</span>
          </button>
        ))}
      </div>

      {lists[tab].length === 0 ? (
        <EmptyState
          title={tab === 'open' ? 'No open offers' : tab === 'mine' ? "You haven't offered or claimed any shifts" : 'No past offers'}
          hint={tab === 'open' && me ? 'Need a shift covered? Use "Offer a shift".' : undefined}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lists[tab].map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      )}

      {picking && (
        <Modal title="Which shift?" onClose={() => setPicking(false)}>
          {myFutureShifts.length === 0 ? (
            <EmptyState title="No upcoming shifts to offer" />
          ) : (
            <div className="space-y-1.5">
              {myFutureShifts.map((s) => (
                <ShiftRow
                  key={s.id}
                  shift={s}
                  employee={employeeById(s.employeeId)}
                  showDate={formatDateShort(s.date)}
                  onClick={() => {
                    setPicking(false)
                    setOffering(s)
                  }}
                />
              ))}
            </div>
          )}
        </Modal>
      )}
      {offering && <OfferModal shift={offering} onClose={() => setOffering(null)} />}
    </div>
  )
}
