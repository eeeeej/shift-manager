import { ArrowLeftRight, CalendarDays, Clock, List, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { OfferCard } from '../components/OfferCard'
import { ShiftRow } from '../components/ShiftCard'
import { ShiftDetailModal } from '../components/ShiftDetailModal'
import { ShiftModal, type ShiftDraft } from '../components/ShiftModal'
import { TimelineGrid } from '../components/TimelineGrid'
import { EmptyState } from '../components/ui'
import { useData } from '../data/DataContext'
import { visibleOffersFor } from '../data/offers'
import type { Shift } from '../types'
import { addDays, dateRange, formatDateShort, startOfWeek, todayKey } from '../utils/time'

const UPCOMING_VIEW_KEY = 'shift-manager:dashboard:upcoming-view'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Stat({ icon: Icon, label, value, to }: { icon: typeof Clock; label: string; value: number | string; to?: string }) {
  const body = (
    <div className="card flex items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700">
        <Icon size={18} />
      </span>
      <div>
        <div className="text-xl font-semibold leading-tight">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export function Dashboard() {
  const { user } = useAuth()
  const { shifts, offers, employees, me, isAdmin, employeeById } = useData()
  const [draft, setDraft] = useState<ShiftDraft | null>(null)
  const [detail, setDetail] = useState<Shift | null>(null)
  const [upcomingView, setUpcomingView] = useState<'list' | 'calendar'>(() =>
    localStorage.getItem(UPCOMING_VIEW_KEY) === 'calendar' ? 'calendar' : 'list',
  )
  const setView = (v: 'list' | 'calendar') => {
    setUpcomingView(v)
    localStorage.setItem(UPCOMING_VIEW_KEY, v)
  }

  const today = todayKey()
  const week = useMemo(() => dateRange(startOfWeek(today), 7), [today])
  const visibleOffers = visibleOffersFor(offers, shifts, me, isAdmin).filter((o) => o.status === 'open')

  const todayShifts = shifts.filter((s) => s.date === today)
  const weekShifts = shifts.filter((s) => week.includes(s.date))
  const myWeek = me ? weekShifts.filter((s) => s.employeeId === me.id) : []
  const myUpcoming = me
    ? shifts
        .filter((s) => s.employeeId === me.id && s.date >= today && s.date <= addDays(today, 14))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
    : []
  const upcomingDays = useMemo(() => dateRange(today, 7), [today])
  const myOfferedIds = useMemo(
    () => new Set(offers.filter((o) => o.status === 'open').map((o) => o.shiftId)),
    [offers],
  )
  const openToday = todayShifts.filter((s) => s.status === 'open').length
  const name = me?.name ?? user?.fullName ?? user?.email?.split('@')[0] ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting()}, {name.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {isAdmin ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={CalendarDays} label="Shifts this week" value={weekShifts.length} to="/schedule" />
            <Stat icon={Clock} label={openToday ? `Today (${openToday} open)` : 'Shifts today'} value={todayShifts.length} />
            <Stat icon={ArrowLeftRight} label="Open trade offers" value={visibleOffers.length} to="/offers" />
            <Stat icon={Users} label="Active staff" value={employees.filter((e) => e.active).length} to="/team" />
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Today</h2>
              <Link to="/schedule" className="text-sm text-slate-600 hover:underline">
                Full schedule →
              </Link>
            </div>
            {todayShifts.length === 0 ? (
              <EmptyState title="No shifts scheduled today" hint="Add one from the Schedule page." />
            ) : (
              <TimelineGrid days={[today]} shifts={todayShifts} employees={employees} onShiftClick={(s) => setDraft({ ...s })} />
            )}
          </section>

          {visibleOffers.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">Open trade offers</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {visibleOffers.slice(0, 4).map((o) => (
                  <OfferCard key={o.id} offer={o} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={CalendarDays} label="My shifts this week" value={myWeek.length} to="/schedule" />
            <Stat icon={Clock} label="Hours this week" value={(myWeek.reduce((a, s) => a + s.endMin - s.startMin, 0) / 60).toFixed(1)} />
            <Stat icon={ArrowLeftRight} label="Offers to claim" value={visibleOffers.filter((o) => o.offeredBy !== me?.id).length} to="/offers" />
          </div>

          {!me && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your login ({user?.email}) isn't linked to an employee yet. Ask a manager to add your email on the Team page.
            </div>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">My upcoming shifts</h2>
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" aria-label="Upcoming shifts view">
                  {(
                    [
                      { v: 'list', icon: List, label: 'List' },
                      { v: 'calendar', icon: CalendarDays, label: 'Calendar' },
                    ] as const
                  ).map(({ v, icon: Icon, label }) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={upcomingView === v}
                      onClick={() => setView(v)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                        upcomingView === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>
                <Link to="/schedule" className="text-sm text-slate-600 hover:underline">
                  Schedule →
                </Link>
              </div>
            </div>
            {upcomingView === 'calendar' ? (
              <TimelineGrid
                days={upcomingDays}
                shifts={myUpcoming.filter((s) => upcomingDays.includes(s.date))}
                employees={employees}
                hideNames
                offeredShiftIds={myOfferedIds}
                onShiftClick={(s) => setDetail(s)}
              />
            ) : myUpcoming.length === 0 ? (
              <EmptyState title="No upcoming shifts in the next two weeks" />
            ) : (
              <div className="space-y-1.5">
                {myUpcoming.map((s) => (
                  <ShiftRow
                    key={s.id}
                    shift={s}
                    employee={employeeById(s.employeeId)}
                    hideName
                    showDate={s.date === today ? 'Today' : formatDateShort(s.date)}
                    onClick={() => setDetail(s)}
                    trailing={
                      offers.some((o) => o.shiftId === s.id && o.status === 'open') ? (
                        <span className="chip bg-amber-100 text-amber-800">offered</span>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Shifts available to claim</h2>
              <Link to="/offers" className="text-sm text-slate-600 hover:underline">
                All offers →
              </Link>
            </div>
            {visibleOffers.filter((o) => o.offeredBy !== me?.id).length === 0 ? (
              <EmptyState title="Nothing up for grabs right now" />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {visibleOffers
                  .filter((o) => o.offeredBy !== me?.id)
                  .map((o) => (
                    <OfferCard key={o.id} offer={o} />
                  ))}
              </div>
            )}
          </section>
        </>
      )}

      {draft && <ShiftModal draft={draft} onClose={() => setDraft(null)} />}
      {detail && <ShiftDetailModal shift={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
