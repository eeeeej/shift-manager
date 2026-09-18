import { ArrowLeftRight, CalendarDays, LayoutDashboard, Power, Settings, Users } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../data/DataContext'
import { visibleOffersFor } from '../data/offers'
import { applyBrand, orgLabel } from '../lib/brand'
import { isDemoMode } from '../lib/supabase'
import { resetDemoData } from '../data/mockStore'
import { InstallBanner } from './InstallBanner'

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { isAdmin, isOwner, me, offers, shifts, org, orgs, setOrg, canCreateOrg } = useData()
  const navigate = useNavigate()
  useEffect(() => applyBrand(org), [org])
  const openOffers = visibleOffersFor(offers, shifts, me, isAdmin).filter((o) => o.status === 'open').length

  const nav = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
    { to: '/offers', label: 'Offers', icon: ArrowLeftRight, badge: openOffers },
    ...(isAdmin ? [{ to: '/team', label: 'Team', icon: Users }] : []),
  ]
  const NEW_ORG = '__new__'

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-[var(--accent)] text-white' : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <div className="min-h-screen pb-16 md:pb-0 short:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 short:py-1">
          <div className="flex items-center gap-2">
            {org?.brand.logoUrl ? (
              <img src={org.brand.logoUrl} alt="" className="h-8 max-w-[40vw] object-contain sm:max-w-[240px]" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">S</span>
            )}
            {orgs.length > 1 || canCreateOrg ? (
              <select
                className="max-w-[45vw] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold short:hidden"
                value={org?.id ?? ''}
                onChange={(e) => (e.target.value === NEW_ORG ? navigate('/new') : setOrg(e.target.value))}
                aria-label="Restaurant"
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {orgLabel(o)}
                  </option>
                ))}
                {canCreateOrg && <option value={NEW_ORG}>+ New restaurant…</option>}
              </select>
            ) : (
              <span className="font-semibold short:hidden">{orgLabel(org)}</span>
            )}
            {isOwner && org && (
              <NavLink to="/settings" className="btn-ghost p-1.5 short:hidden" title="Restaurant settings" aria-label="Restaurant settings">
                <Settings size={16} />
              </NavLink>
            )}
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
            <span className="text-[10px] text-slate-400" title="Build">
              {__BUILD_ID__}
            </span>
          </div>
          <nav className="hidden items-center gap-1 md:flex short:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkCls}>
                <n.icon size={16} />
                {n.label}
                {n.badge ? <span className="rounded-full bg-amber-400 px-1.5 text-[10px] text-slate-900">{n.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-600 sm:inline short:hidden">
              {me?.name ?? user?.fullName ?? user?.email}
              <span className="ml-1.5 chip bg-slate-100 text-slate-600">{isOwner ? 'owner' : isAdmin ? 'manager' : 'staff'}</span>
            </span>
            <button className="btn-ghost flex items-center gap-1 px-2 py-2 text-xs text-slate-600" onClick={signOut} title="Sign out">
              <Power size={15} /> <span className="hidden sm:inline short:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:py-6 short:py-1">
        <InstallBanner />
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden short:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
