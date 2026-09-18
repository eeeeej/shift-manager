/** Positions a new organization starts with; each org keeps its own list. */
export const DEFAULT_POSITIONS = ['Server', 'Bartender', 'Bar Back', 'Host', 'Busser', 'Kitchen', 'Manager']
export type Position = string

/** owner > admin (manager) > employee (staff). */
export type Role = 'owner' | 'admin' | 'employee'
export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', admin: 'Manager', employee: 'Staff' }
export const isManagerRole = (r: Role | undefined) => r === 'admin' || r === 'owner'

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

/** Fields an org admin may edit (slug/plan are platform-only). */
export interface OrganizationInput {
  name: string
  timezone: string
  positions: Position[]
  brand: OrgBrand
}

export interface NewOrganizationInput {
  name: string
  slug: string
  positions?: Position[]
}

/** URL-safe short name: lowercase words joined by single dashes. */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

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

/** Login state of an employee's linked account (managers only). */
export interface AccountStatus {
  employeeId: string
  confirmedAt: string | null
  lastSeenAt: string | null
}

export type ShiftStatus = 'scheduled' | 'open'

/** A week (Sunday start, YYYY-MM-DD) whose shifts are visible to staff. */
export interface PublishedWeek {
  weekStart: string
  publishedAt: string
  /** Display name of who published it; null for weeks that predate publishing. */
  publishedBy: string | null
}

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
