import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TimeOffCard } from '../components/TimeOffCard'
import { TimeOffModal } from '../components/TimeOffModal'
import { EmptyState, PageHeader } from '../components/ui'
import { useData } from '../data/DataContext'
import { visibleOffersFor } from '../data/offers'
import { todayKey } from '../utils/time'
import { OffersSection } from './Offers'

type Section = 'offers' | 'timeoff'

export function Requests() {
  const { offers, shifts, timeOff, me, isAdmin } = useData()
  const [params, setParams] = useSearchParams()
  const section: Section = params.get('tab') === 'timeoff' ? 'timeoff' : 'offers'

  const openOffers = visibleOffersFor(offers, shifts, me, isAdmin).filter((o) => o.status === 'open').length
  const pendingTimeOff = timeOff.filter((r) => r.status === 'pending' && (isAdmin || r.employeeId === me?.id)).length

  const sections: { key: Section; label: string; badge: number }[] = [
    { key: 'offers', label: 'Shift offers', badge: openOffers },
    { key: 'timeoff', label: 'Time off', badge: pendingTimeOff },
  ]

  return (
    <div>
      <PageHeader title="Requests" subtitle={isAdmin ? 'Shift trades and time off across the team' : 'Shift trades and your time off'} />
      <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setParams(s.key === 'offers' ? {} : { tab: s.key }, { replace: true })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              section === s.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {s.label}
            {s.badge > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--accent)] px-1.5 text-xs font-semibold text-white">{s.badge}</span>
            )}
          </button>
        ))}
      </div>
      {section === 'offers' ? <OffersSection /> : <TimeOffSection />}
    </div>
  )
}

type Tab = 'pending' | 'upcoming' | 'history'

function TimeOffSection() {
  const { timeOff, me, isAdmin } = useData()
  const [tab, setTab] = useState<Tab>('pending')
  const [requesting, setRequesting] = useState(false)
  const today = todayKey()

  // Staff see their own requests here; approved time off of others shows on the schedule instead.
  const visible = isAdmin ? timeOff : timeOff.filter((r) => r.employeeId === me?.id)
  const lists: Record<Tab, typeof visible> = {
    pending: visible.filter((r) => r.status === 'pending').sort((a, b) => a.startDate.localeCompare(b.startDate)),
    upcoming: visible.filter((r) => r.status === 'approved' && r.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    history: visible
      .filter((r) => r.status === 'denied' || r.status === 'cancelled' || (r.status === 'approved' && r.endDate < today))
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
  }
  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'upcoming', label: 'Approved' },
    { key: 'history', label: 'History' },
  ]

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {isAdmin ? 'Approve or deny; approved days show as "off" on the schedule.' : 'Ask for days off — any date, even before the schedule is out.'}
        </p>
        {(me || isAdmin) && (
          <button className="btn-primary flex-shrink-0" onClick={() => setRequesting(true)}>
            <Plus size={16} /> Request time off
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
          title={tab === 'pending' ? 'No pending requests' : tab === 'upcoming' ? 'No upcoming time off' : 'Nothing here yet'}
          hint={tab === 'pending' && !isAdmin ? 'Need a day off? Use "Request time off".' : undefined}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lists[tab].map((r) => (
            <TimeOffCard key={r.id} request={r} />
          ))}
        </div>
      )}

      {requesting && <TimeOffModal onClose={() => setRequesting(false)} />}
    </div>
  )
}
