import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  type AccountStatus,
  type BrandImageKind,
  DEFAULT_POSITIONS,
  isManagerRole,
  type Employee,
  type EmployeeInput,
  type NewOrganizationInput,
  type Organization,
  type OrganizationInput,
  type Position,
  type PublishedWeek,
  type Shift,
  type ShiftInput,
  type ShiftOffer,
} from '../types'
import type { Snapshot } from './store'
import { isDemoMode, supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { applyBrand } from '../lib/brand'
import type { DataStore, OfferInput } from './store'
import { MockStore } from './mockStore'
import { SupabaseStore } from './supabaseStore'
import { startOfWeek, todayKey } from '../utils/time'

export interface DataApi {
  /** Organizations the signed-in user can access. */
  orgs: Organization[]
  /** The organization currently being viewed; null until orgs have loaded (or if the user has none). */
  org: Organization | null
  setOrg(orgId: string): void
  /** True when the signed-in user may create a restaurant (platform admin, or self-serve enabled). */
  canCreateOrg: boolean
  /** Creates a restaurant and switches to it; resolves with its id. */
  createOrganization(input: NewOrganizationInput): Promise<string>
  updateOrganization(patch: Partial<OrganizationInput>): Promise<void>
  /** Uploads a processed logo/icon for the current restaurant; resolves with its public URL. */
  uploadBrandImage(kind: BrandImageKind, blob: Blob): Promise<string>
  /** Positions of the current organization. */
  positions: Position[]
  employees: Employee[]
  shifts: Shift[]
  offers: ShiftOffer[]
  /** Weeks visible to staff. Weeks up to and including the current one are always published. */
  publishedWeeks: PublishedWeek[]
  isWeekPublished(date: string): boolean
  /** Manager: publish every draft week from the current week through the one containing `date`. */
  publishThrough(date: string): Promise<void>
  loading: boolean
  error: string | null
  /** The employee record linked to the signed-in user, if any. */
  me: Employee | null
  /** Manager or owner of the current restaurant (or platform admin). */
  isAdmin: boolean
  /** Owner of the current restaurant (or platform admin): settings + role changes. */
  isOwner: boolean
  reload(): Promise<void>
  employeeById(id: string | null): Employee | undefined
  shiftById(id: string): Shift | undefined

  createShift(input: ShiftInput): Promise<void>
  updateShift(id: string, patch: Partial<ShiftInput>): Promise<void>
  deleteShift(id: string): Promise<void>
  /** Batch insert; resolves with the created shifts so the caller can undo. */
  createShifts(inputs: ShiftInput[]): Promise<Shift[]>
  deleteShifts(ids: string[]): Promise<void>

  createEmployee(input: EmployeeInput): Promise<void>
  updateEmployee(id: string, patch: Partial<EmployeeInput>): Promise<void>
  deleteEmployee(id: string): Promise<void>
  inviteEmployee(id: string): Promise<void>
  /** Manager-only login status per linked employee. */
  accountStatus(): Promise<AccountStatus[]>

  createOffer(input: OfferInput): Promise<void>
  claimOffer(offerId: string, claimerEmployeeId: string): Promise<void>
  cancelOffer(offerId: string, outcome?: 'cancelled' | 'reassigned'): Promise<void>
}

const DataContext = createContext<DataApi | null>(null)

const store: DataStore = isDemoMode ? new MockStore() : new SupabaseStore(supabase!)
const EMPTY: Snapshot = { employees: [], shifts: [], offers: [], publishedWeeks: [] }
const ORG_KEY = 'shift-manager:org'

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [orgId, setOrgId] = useState<string | null>(() => localStorage.getItem(ORG_KEY))
  const [rawEmployees, setEmployees] = useState<Employee[]>([])
  const [rawShifts, setShifts] = useState<Shift[]>([])
  const [rawOffers, setOffers] = useState<ShiftOffer[]>([])
  const [rawWeeks, setWeeks] = useState<PublishedWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selfServe, setSelfServe] = useState(false)

  const org = useMemo(() => orgs.find((o) => o.id === orgId) ?? null, [orgs, orgId])
  // Applied here (not in Layout) so public pages like /install also install the org's icon/name.
  useEffect(() => applyBrand(org), [org])

  const setOrg = useCallback((id: string) => {
    localStorage.setItem(ORG_KEY, id)
    setOrgId(id)
    setLoading(true)
  }, [])

  const reload = useCallback(async () => {
    try {
      const [list, selfServeOn] = await Promise.all([store.loadOrganizations(), store.selfServeOrgsEnabled()])
      setOrgs(list)
      setSelfServe(selfServeOn)
      // Fall back to the first org when none is chosen or the saved one is gone.
      const current = list.find((o) => o.id === orgId) ?? list[0] ?? null
      if (current && current.id !== orgId) {
        localStorage.setItem(ORG_KEY, current.id)
        setOrgId(current.id)
      }
      if (!current) {
        setEmployees([])
        setShifts([])
        setOffers([])
        setWeeks([])
        setError(null)
        return
      }
      const snap: Snapshot = await store.load(current.id)
      setEmployees(snap.employees)
      setShifts(snap.shifts)
      setOffers(snap.offers)
      setWeeks(snap.publishedWeeks)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    if (user) reload()
  }, [user, reload])

  // Keep other people's changes visible: refetch when the app comes back to the
  // foreground, and on any DB change (Supabase realtime) with a short debounce.
  useEffect(() => {
    if (!user) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void reload(), 300)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') soon()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', soon)
    const channel = supabase
      ?.channel('data-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_offers' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'published_weeks' }, soon)
      .subscribe()
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', soon)
      if (channel) void supabase?.removeChannel(channel)
    }
  }, [user, reload])

  const employees = user ? rawEmployees : EMPTY.employees
  const publishedWeeks = user ? rawWeeks : EMPTY.publishedWeeks

  const me = useMemo(() => {
    if (!user) return null
    return (
      employees.find((e) => e.userId === user.id) ??
      employees.find((e) => e.email && e.email.toLowerCase() === user.email.toLowerCase()) ??
      null
    )
  }, [employees, user])

  const membership = user && org ? user.memberships.find((m) => m.orgId === org.id) : undefined
  const isAdmin = Boolean(user?.isSuperadmin) || isManagerRole(membership?.role) || isManagerRole(me?.role)
  const isOwner = Boolean(user?.isSuperadmin) || membership?.role === 'owner' || me?.role === 'owner'
  const positions = org?.positions ?? DEFAULT_POSITIONS
  const publishedSet = useMemo(() => new Set(publishedWeeks.map((w) => w.weekStart)), [publishedWeeks])
  const isWeekPublished = useCallback(
    (date: string) => {
      const w = startOfWeek(date)
      return w <= startOfWeek(todayKey()) || publishedSet.has(w)
    },
    [publishedSet],
  )
  // RLS already hides drafts from staff; this keeps demo mode honest and the UI consistent.
  const shifts = useMemo(() => {
    if (!user) return EMPTY.shifts
    return isAdmin ? rawShifts : rawShifts.filter((s) => isWeekPublished(s.date))
  }, [user, isAdmin, rawShifts, isWeekPublished])
  const offers = useMemo(() => {
    if (!user) return EMPTY.offers
    if (isAdmin) return rawOffers
    const visible = new Set(shifts.map((s) => s.id))
    return rawOffers.filter((o) => visible.has(o.shiftId))
  }, [user, isAdmin, rawOffers, shifts])
  const canCreateOrg = Boolean(user?.isSuperadmin) || selfServe
  const requireOrg = useCallback(() => {
    if (!org) throw new Error('No organization selected')
    return org.id
  }, [org])

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      await fn()
      await reload()
    },
    [reload],
  )

  const api: DataApi = useMemo(
    () => ({
      orgs,
      org,
      setOrg,
      canCreateOrg,
      createOrganization: async (input) => {
        const id = await store.createOrganization(input)
        setOrg(id)
        return id
      },
      updateOrganization: (patch) => run(() => store.updateOrganization(requireOrg(), patch)),
      uploadBrandImage: (kind, blob) => store.uploadBrandImage(requireOrg(), kind, blob),
      positions,
      employees,
      shifts,
      offers,
      publishedWeeks,
      isWeekPublished,
      publishThrough: (date) => run(() => store.publishWeeks(requireOrg(), date, me?.name ?? user?.fullName ?? user?.email ?? '')),
      loading,
      error,
      me,
      isAdmin,
      isOwner,
      reload,
      employeeById: (id) => (id ? employees.find((e) => e.id === id) : undefined),
      shiftById: (id) => shifts.find((s) => s.id === id),
      createShift: (input) => run(() => store.createShift(requireOrg(), input)),
      updateShift: (id, patch) => run(() => store.updateShift(id, patch)),
      deleteShift: (id) => run(() => store.deleteShift(id)),
      createShifts: async (inputs) => {
        const created = await store.createShifts(requireOrg(), inputs)
        await reload()
        return created
      },
      deleteShifts: (ids) => run(() => store.deleteShifts(ids)),
      createEmployee: (input) => run(() => store.createEmployee(requireOrg(), input)),
      updateEmployee: (id, patch) => run(() => store.updateEmployee(id, patch)),
      deleteEmployee: (id) => run(() => store.deleteEmployee(id)),
      inviteEmployee: (id) => store.inviteEmployee(id),
      accountStatus: () => store.accountStatus(requireOrg()),
      createOffer: (input) => run(() => store.createOffer(input)),
      claimOffer: (offerId, claimer) => run(() => store.claimOffer(offerId, claimer)),
      cancelOffer: (offerId, outcome) =>
        run(() => store.cancelOffer(offerId, me?.name ?? user?.fullName ?? user?.email, outcome)),
    }),
    [orgs, org, setOrg, canCreateOrg, positions, employees, shifts, offers, publishedWeeks, isWeekPublished, loading, error, me, isAdmin, isOwner, reload, run, user, requireOrg],
  )

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>
}

export function useData(): DataApi {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
