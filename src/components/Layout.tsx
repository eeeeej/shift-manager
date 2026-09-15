import { ArrowLeftRight, CalendarDays, Home, LogOut, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../data/DataContext'
import { visibleOffersFor } from '../data/offers'
import { isDemoMode } from '../lib/supabase'
import { resetDemoData } from '../data/mockStore'

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { isAdmin, me, offers, shifts } = useData()
  const openOffers = visibleOffersFor(offers, shifts, me, isAdmin).filter((o) => o.status === 'open').length

  const nav = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
    { to: '/offers', label: 'Offers', icon: ArrowLeftRight, badge: openOffers },
    ...(isAdmin ? [{ to: '/team', label: 'Team', icon: Users }] : []),
  ]

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">S</span>
            <span className="font-semibold">Shift Manager</span>
            {isDemoMode && (
              <button
                className="chip ml-2 bg-amber-100 text-amber-800 hover:bg-amber-200"
                title="No Supabase configured. Click to reset demo data."
                onClick={() => {
                  if (confirm('Reset demo data to the spreadsheet seed?')) {
                    resetDemoData()
                    location.reload()
                  }
                }}
              >
                demo
              </button>
            )}
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkCls}>
                <n.icon size={16} />
                {n.label}
                {n.badge ? <span className="rounded-full bg-amber-400 px-1.5 text-[10px] text-slate-900">{n.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-600 sm:inline">
              {me?.name ?? user?.fullName ?? user?.email}
              <span className="ml-1.5 chip bg-slate-100 text-slate-600">{isAdmin ? 'admin' : 'staff'}</span>
            </span>
            <button className="btn-ghost p-2" onClick={signOut} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:py-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-slate-900' : 'text-slate-500'}`
            }
          >
            <n.icon size={20} />
            {n.label}
            {n.badge ? (
              <span className="absolute right-1/4 top-1 rounded-full bg-amber-400 px-1.5 text-[10px] text-slate-900">{n.badge}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
