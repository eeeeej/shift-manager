export const POSITIONS = ['Server', 'Bartender', 'Bar Back', 'Host', 'Busser', 'Kitchen', 'Manager'] as const
export type Position = (typeof POSITIONS)[number]

export type Role = 'admin' | 'employee'

export interface Profile {
  id: string
  email: string
  role: Role
  fullName: string | null
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

export type OfferStatus = 'open' | 'claimed' | 'cancelled'

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
