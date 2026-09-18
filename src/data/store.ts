import type { Employee, EmployeeInput, NewOrganizationInput, Organization, OrganizationInput, Shift, ShiftInput, ShiftOffer } from '../types'

export interface Snapshot {
  employees: Employee[]
  shifts: Shift[]
  offers: ShiftOffer[]
}

export interface OfferInput {
  shiftId: string
  offeredBy: string
  targetEmployeeId: string | null
  message: string | null
}

export interface DataStore {
  /** Organizations the signed-in user belongs to. */
  loadOrganizations(): Promise<Organization[]>
  /** Whether anyone (not just platform admins) may create a restaurant. */
  selfServeOrgsEnabled(): Promise<boolean>
  createOrganization(input: NewOrganizationInput): Promise<string>
  updateOrganization(id: string, patch: Partial<OrganizationInput>): Promise<Organization>
  /** Everything for one organization. RLS is the authority; the filter keeps multi-org users' data apart. */
  load(orgId: string): Promise<Snapshot>

  createShift(orgId: string, input: ShiftInput): Promise<Shift>
  updateShift(id: string, patch: Partial<ShiftInput>): Promise<Shift>
  deleteShift(id: string): Promise<void>
  createShifts(orgId: string, inputs: ShiftInput[]): Promise<Shift[]>
  deleteShifts(ids: string[]): Promise<void>

  createEmployee(orgId: string, input: EmployeeInput): Promise<Employee>
  updateEmployee(id: string, patch: Partial<EmployeeInput>): Promise<Employee>
  deleteEmployee(id: string): Promise<void>
  /** Send a login invite to the employee's email. */
  inviteEmployee(id: string): Promise<void>

  createOffer(input: OfferInput): Promise<ShiftOffer>
  /** Claim an open offer: reassigns the shift to the claimer and closes the offer. */
  claimOffer(offerId: string, claimerEmployeeId: string): Promise<void>
  /** `outcome` is 'reassigned' when a manager moved the shift instead of cancelling the offer outright. */
  cancelOffer(offerId: string, byName?: string, outcome?: 'cancelled' | 'reassigned'): Promise<void>
}
