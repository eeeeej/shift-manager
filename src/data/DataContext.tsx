import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Employee, EmployeeInput, Shift, ShiftInput, ShiftOffer } from '../types'
import type { Snapshot } from './store'
import { isDemoMode, supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import type { DataStore, OfferInput } from './store'
import { MockStore } from './mockStore'
import { SupabaseStore } from './supabaseStore'

export interface DataApi {
  employees: Employee[]
  shifts: Shift[]
  offers: ShiftOffer[]
  loading: boolean
  error: string | null
  /** The employee record linked to the signed-in user, if any. */
  me: Employee | null
  isAdmin: boolean
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

  createOffer(input: OfferInput): Promise<void>
  claimOffer(offerId: string, claimerEmployeeId: string): Promise<void>
  cancelOffer(offerId: string, outcome?: 'cancelled' | 'reassigned'): Promise<void>
}

const DataContext = createContext<DataApi | null>(null)

const store: DataStore = isDemoMode ? new MockStore() : new SupabaseStore(supabase!)
const EMPTY: Snapshot = { employees: [], shifts: [], offers: [] }

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [rawEmployees, setEmployees] = useState<Employee[]>([])
  const [rawShifts, setShifts] = useState<Shift[]>([])
  const [rawOffers, setOffers] = useState<ShiftOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const snap: Snapshot = await store.load()
      setEmployees(snap.employees)
      setShifts(snap.shifts)
      setOffers(snap.offers)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

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
      .subscribe()
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', soon)
      if (channel) void supabase?.removeChannel(channel)
    }
  }, [user, reload])

  const employees = user ? rawEmployees : EMPTY.employees
  const shifts = user ? rawShifts : EMPTY.shifts
  const offers = user ? rawOffers : EMPTY.offers

  const me = useMemo(() => {
    if (!user) return null
    return (
      employees.find((e) => e.userId === user.id) ??
      employees.find((e) => e.email && e.email.toLowerCase() === user.email.toLowerCase()) ??
      null
    )
  }, [employees, user])

  const isAdmin = me ? me.role === 'admin' : user?.role === 'admin'

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      await fn()
      await reload()
    },
    [reload],
  )

  const api: DataApi = useMemo(
    () => ({
      employees,
      shifts,
      offers,
      loading,
      error,
      me,
      isAdmin,
      reload,
      employeeById: (id) => (id ? employees.find((e) => e.id === id) : undefined),
      shiftById: (id) => shifts.find((s) => s.id === id),
      createShift: (input) => run(() => store.createShift(input)),
      updateShift: (id, patch) => run(() => store.updateShift(id, patch)),
      deleteShift: (id) => run(() => store.deleteShift(id)),
      createShifts: async (inputs) => {
        const created = await store.createShifts(inputs)
        await reload()
        return created
      },
      deleteShifts: (ids) => run(() => store.deleteShifts(ids)),
      createEmployee: (input) => run(() => store.createEmployee(input)),
      updateEmployee: (id, patch) => run(() => store.updateEmployee(id, patch)),
      deleteEmployee: (id) => run(() => store.deleteEmployee(id)),
      inviteEmployee: (id) => store.inviteEmployee(id),
      createOffer: (input) => run(() => store.createOffer(input)),
      claimOffer: (offerId, claimer) => run(() => store.claimOffer(offerId, claimer)),
      cancelOffer: (offerId, outcome) =>
        run(() => store.cancelOffer(offerId, me?.name ?? user?.fullName ?? user?.email, outcome)),
    }),
    [employees, shifts, offers, loading, error, me, isAdmin, reload, run, user],
  )

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>
}

export function useData(): DataApi {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
