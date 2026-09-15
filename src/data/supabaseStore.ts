import type { SupabaseClient } from '@supabase/supabase-js'
import type { Employee, EmployeeInput, OfferStatus, Position, Role, Shift, ShiftInput, ShiftOffer, ShiftStatus } from '../types'
import type { DataStore, OfferInput, Snapshot } from './store'

interface EmployeeRow {
  id: string
  name: string
  positions: string[]
  email: string | null
  phone: string | null
  user_id: string | null
  color: string
  active: boolean
  role: Role
}

interface ShiftRow {
  id: string
  employee_id: string | null
  position: string
  shift_date: string
  start_min: number
  end_min: number
  notes: string | null
  status: ShiftStatus
  color: string | null
}

interface OfferRow {
  id: string
  shift_id: string
  offered_by: string
  target_employee_id: string | null
  claimed_by: string | null
  status: OfferStatus
  message: string | null
  created_at: string
  resolved_at: string | null
}

const toEmployee = (r: EmployeeRow): Employee => ({
  id: r.id,
  name: r.name,
  positions: r.positions as Position[],
  email: r.email,
  phone: r.phone,
  userId: r.user_id,
  color: r.color,
  active: r.active,
  role: r.role,
})

const toShift = (r: ShiftRow): Shift => ({
  id: r.id,
  employeeId: r.employee_id,
  position: r.position as Position,
  date: r.shift_date,
  startMin: r.start_min,
  endMin: r.end_min,
  notes: r.notes,
  status: r.status,
  color: r.color,
})

const toOffer = (r: OfferRow): ShiftOffer => ({
  id: r.id,
  shiftId: r.shift_id,
  offeredBy: r.offered_by,
  targetEmployeeId: r.target_employee_id,
  claimedBy: r.claimed_by,
  status: r.status,
  message: r.message,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
})

function shiftPatch(p: Partial<ShiftInput>): Partial<ShiftRow> {
  const row: Partial<ShiftRow> = {}
  if ('employeeId' in p) row.employee_id = p.employeeId ?? null
  if (p.position !== undefined) row.position = p.position
  if (p.date !== undefined) row.shift_date = p.date
  if (p.startMin !== undefined) row.start_min = p.startMin
  if (p.endMin !== undefined) row.end_min = p.endMin
  if ('notes' in p) row.notes = p.notes ?? null
  if (p.status !== undefined) row.status = p.status
  if ('color' in p) row.color = p.color ?? null
  return row
}

function employeePatch(p: Partial<EmployeeInput>): Partial<EmployeeRow> {
  const row: Partial<EmployeeRow> = {}
  if (p.name !== undefined) row.name = p.name
  if (p.positions !== undefined) row.positions = p.positions
  if ('email' in p) row.email = p.email ?? null
  if ('phone' in p) row.phone = p.phone ?? null
  if (p.color !== undefined) row.color = p.color
  if (p.active !== undefined) row.active = p.active
  if (p.role !== undefined) row.role = p.role
  return row
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  if (res.data === null) throw new Error('No data returned')
  return res.data
}

export class SupabaseStore implements DataStore {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async load(): Promise<Snapshot> {
    const [emps, shifts, offers] = await Promise.all([
      this.client.from('employees').select('*').order('name'),
      this.client.from('shifts').select('*').order('shift_date').order('start_min'),
      this.client.from('shift_offers').select('*').order('created_at', { ascending: false }),
    ])
    return {
      employees: unwrap<EmployeeRow[]>(emps).map(toEmployee),
      shifts: unwrap<ShiftRow[]>(shifts).map(toShift),
      offers: unwrap<OfferRow[]>(offers).map(toOffer),
    }
  }

  async createShift(input: ShiftInput): Promise<Shift> {
    const res = await this.client.from('shifts').insert(shiftPatch(input)).select('*').single()
    return toShift(unwrap<ShiftRow>(res))
  }

  async updateShift(id: string, patch: Partial<ShiftInput>): Promise<Shift> {
    const res = await this.client.from('shifts').update(shiftPatch(patch)).eq('id', id).select('*').single()
    return toShift(unwrap<ShiftRow>(res))
  }

  async deleteShift(id: string): Promise<void> {
    const { error } = await this.client.from('shifts').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async createShifts(inputs: ShiftInput[]): Promise<Shift[]> {
    if (inputs.length === 0) return []
    const res = await this.client.from('shifts').insert(inputs.map(shiftPatch)).select('*')
    return unwrap<ShiftRow[]>(res).map(toShift)
  }

  async deleteShifts(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const { error } = await this.client.from('shifts').delete().in('id', ids)
    if (error) throw new Error(error.message)
  }

  async createEmployee(input: EmployeeInput): Promise<Employee> {
    const res = await this.client.from('employees').insert(employeePatch(input)).select('*').single()
    return toEmployee(unwrap<EmployeeRow>(res))
  }

  async updateEmployee(id: string, patch: Partial<EmployeeInput>): Promise<Employee> {
    const res = await this.client.from('employees').update(employeePatch(patch)).eq('id', id).select('*').single()
    return toEmployee(unwrap<EmployeeRow>(res))
  }

  async deleteEmployee(id: string): Promise<void> {
    const { error } = await this.client.from('employees').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async inviteEmployee(id: string): Promise<void> {
    const res = await this.client.from('employees').select('email').eq('id', id).single()
    const email = unwrap<{ email: string | null }>(res).email
    if (!email) throw new Error('Employee has no email')
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/login`, shouldCreateUser: true },
    })
    if (error) throw new Error(error.message)
  }

  async createOffer(input: OfferInput): Promise<ShiftOffer> {
    const res = await this.client
      .from('shift_offers')
      .insert({
        shift_id: input.shiftId,
        offered_by: input.offeredBy,
        target_employee_id: input.targetEmployeeId,
        message: input.message,
      })
      .select('*')
      .single()
    return toOffer(unwrap<OfferRow>(res))
  }

  async claimOffer(offerId: string): Promise<void> {
    const { error } = await this.client.rpc('claim_offer', { p_offer_id: offerId })
    if (error) throw new Error(error.message)
  }

  async cancelOffer(offerId: string): Promise<void> {
    const { error } = await this.client
      .from('shift_offers')
      .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
      .eq('id', offerId)
    if (error) throw new Error(error.message)
  }
}
