/** Positions a new organization starts with; each org keeps its own list. */
export const DEFAULT_POSITIONS = ['Server', 'Bartender', 'Bar Back', 'Host', 'Busser', 'Kitchen', 'Manager']
export type Position = string

export type Role = 'admin' | 'employee'

export interface Membership {
  orgId: string
  role: Role
}

export interface Profile {
  id: string
  email: string
  fullName: string | null
  /** Platform operator: may create restaurants and manage every organization. */
  isSuperadmin: boolean
  memberships: Membership[]
}

export interface OrgBrand {
  displayName?: string
  accentColor?: string
  logoUrl?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  timezone: string
  positions: Position[]
  brand: OrgBrand
  plan: string
}

export interface Employee {
  id: string
  name: string
  positions: Position[]
  email: string | null
  phone: string | null
  userId: string | null
  color: string
  active: boolean
  /** admin = owner/manager; mirrored onto the linked login account */
  role: Role
}

export type ShiftStatus = 'scheduled' | 'open'

export interface Shift {
  id: string
  employeeId: string | null
  position: Position
  /** YYYY-MM-DD, local */
  date: string
  /** minutes from midnight */
  startMin: number
  endMin: number
  notes: string | null
  status: ShiftStatus
  color: string | null
}

export type OfferStatus = 'open' | 'claimed' | 'cancelled' | 'reassigned'

export interface ShiftOffer {
  id: string
  shiftId: string
  offeredBy: string
  /** null = broadcast to everyone sharing the shift's position */
  targetEmployeeId: string | null
  claimedBy: string | null
  status: OfferStatus
  message: string | null
  createdAt: string
  resolvedAt: string | null
  /** Name of whoever claimed/cancelled it */
  resolvedByName: string | null
}

export type ShiftInput = Omit<Shift, 'id'>
export type EmployeeInput = Omit<Employee, 'id' | 'userId'>
