import { DEFAULT_POSITIONS, type Employee, type EmployeeInput, type Organization, type Shift, type ShiftInput, type ShiftOffer } from '../types'
import type { DataStore, OfferInput, Snapshot } from './store'
import { SEED_EMPLOYEES, SEED_OFFERS, SEED_SHIFTS } from './seed'
import { setDemoAccountRole } from '../auth/AuthContext'

const KEY = 'shift-manager:demo:v2'

/** The single organization demo mode runs as. */
export const DEMO_ORG: Organization = {
  id: 'org-demo',
  name: "Francie's",
  slug: 'francies',
  timezone: 'America/Chicago',
  positions: DEFAULT_POSITIONS,
  brand: {},
  plan: 'free',
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function readSnapshot(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const snap = JSON.parse(raw) as Snapshot
      snap.employees = snap.employees.map((e) => ({ ...e, role: e.role ?? 'employee' }))
      return snap
    }
  } catch {
    /* fall through to seed */
  }
  return { employees: SEED_EMPLOYEES, shifts: SEED_SHIFTS, offers: SEED_OFFERS }
}

/** Demo counterpart of the invite-only signup trigger: active employee emails. */
export function isInvitedDemoEmail(email: string): boolean {
  const e = email.toLowerCase()
  return readSnapshot().employees.some((emp) => emp.active && emp.email?.toLowerCase() === e)
}

export function resetDemoData() {
  localStorage.removeItem(KEY)
}

export class MockStore implements DataStore {
  private snap: Snapshot = readSnapshot()

  private persist() {
    localStorage.setItem(KEY, JSON.stringify(this.snap))
  }

  async loadOrganizations(): Promise<Organization[]> {
    return [DEMO_ORG]
  }

  async load(): Promise<Snapshot> {
    return structuredClone(this.snap)
  }

  async createShift(_orgId: string, input: ShiftInput): Promise<Shift> {
    const shift: Shift = { ...input, id: uid('shift') }
    this.snap.shifts.push(shift)
    this.persist()
    return shift
  }

  async updateShift(id: string, patch: Partial<ShiftInput>): Promise<Shift> {
    const idx = this.snap.shifts.findIndex((s) => s.id === id)
    if (idx < 0) throw new Error('Shift not found')
    const next = { ...this.snap.shifts[idx], ...patch }
    this.snap.shifts[idx] = next
    this.persist()
    return next
  }

  async deleteShift(id: string): Promise<void> {
    this.snap.shifts = this.snap.shifts.filter((s) => s.id !== id)
    this.snap.offers = this.snap.offers.filter((o) => o.shiftId !== id)
    this.persist()
  }

  async createShifts(_orgId: string, inputs: ShiftInput[]): Promise<Shift[]> {
    const created = inputs.map((input) => ({ ...input, id: uid('shift') }))
    this.snap.shifts.push(...created)
    this.persist()
    return created
  }

  async deleteShifts(ids: string[]): Promise<void> {
    const set = new Set(ids)
    this.snap.shifts = this.snap.shifts.filter((s) => !set.has(s.id))
    this.snap.offers = this.snap.offers.filter((o) => !set.has(o.shiftId))
    this.persist()
  }

  async createEmployee(_orgId: string, input: EmployeeInput): Promise<Employee> {
    const employee: Employee = { ...input, id: uid('emp'), userId: null }
    this.snap.employees.push(employee)
    this.persist()
    return employee
  }

  async updateEmployee(id: string, patch: Partial<EmployeeInput>): Promise<Employee> {
    const idx = this.snap.employees.findIndex((e) => e.id === id)
    if (idx < 0) throw new Error('Employee not found')
    const next = { ...this.snap.employees[idx], ...patch }
    this.snap.employees[idx] = next
    if (patch.role && next.email) setDemoAccountRole(next.email, patch.role)
    this.persist()
    return next
  }

  async deleteEmployee(id: string): Promise<void> {
    this.snap.employees = this.snap.employees.filter((e) => e.id !== id)
    this.snap.shifts = this.snap.shifts.map((s) =>
      s.employeeId === id ? { ...s, employeeId: null, status: 'open' } : s,
    )
    this.persist()
  }

  async inviteEmployee(id: string): Promise<void> {
    const emp = this.snap.employees.find((e) => e.id === id)
    if (!emp?.email) throw new Error('Employee has no email')
    await new Promise((r) => setTimeout(r, 400))
  }

  async createOffer(input: OfferInput): Promise<ShiftOffer> {
    const offer: ShiftOffer = {
      ...input,
      id: uid('offer'),
      claimedBy: null,
      status: 'open',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedByName: null,
    }
    this.snap.offers.push(offer)
    this.persist()
    return offer
  }

  async claimOffer(offerId: string, claimerEmployeeId: string): Promise<void> {
    const offer = this.snap.offers.find((o) => o.id === offerId)
    if (!offer || offer.status !== 'open') throw new Error('Offer is no longer open')
    const now = new Date().toISOString()
    offer.claimedBy = claimerEmployeeId
    offer.status = 'claimed'
    offer.resolvedAt = now
    offer.resolvedByName = this.snap.employees.find((e) => e.id === claimerEmployeeId)?.name ?? null
    for (const other of this.snap.offers) {
      if (other.id !== offerId && other.shiftId === offer.shiftId && other.status === 'open') {
        other.status = 'cancelled'
        other.resolvedAt = now
        other.resolvedByName = offer.resolvedByName
      }
    }
    await this.updateShift(offer.shiftId, { employeeId: claimerEmployeeId, status: 'scheduled' })
  }

  async cancelOffer(offerId: string, byName?: string, outcome: 'cancelled' | 'reassigned' = 'cancelled'): Promise<void> {
    const offer = this.snap.offers.find((o) => o.id === offerId)
    if (!offer) return
    offer.status = outcome
    offer.resolvedAt = new Date().toISOString()
    offer.resolvedByName = byName ?? null
    this.persist()
  }
}
