import type { Employee, Shift, ShiftOffer } from '../types'

/** Offers the given employee is allowed to see and act on. */
export function visibleOffersFor(
  offers: ShiftOffer[],
  shifts: Shift[],
  employee: Employee | null,
  isAdmin: boolean,
): ShiftOffer[] {
  if (isAdmin) return offers
  if (!employee) return []
  return offers.filter((o) => {
    if (o.offeredBy === employee.id || o.targetEmployeeId === employee.id || o.claimedBy === employee.id) return true
    if (o.targetEmployeeId) return false
    const shift = shifts.find((s) => s.id === o.shiftId)
    return !!shift && employee.positions.includes(shift.position)
  })
}
