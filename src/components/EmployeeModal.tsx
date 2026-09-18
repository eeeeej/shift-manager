import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useData } from '../data/DataContext'
import type { Employee, EmployeeInput, Position } from '../types'
import { nextColor, PALETTE } from '../utils/colors'
import { ErrorText, Modal } from './ui'

export function EmployeeModal({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const { employees, me, positions: orgPositions, createEmployee, updateEmployee, deleteEmployee } = useData()
  const [name, setName] = useState(employee?.name ?? '')
  const [positions, setPositions] = useState<Position[]>(employee?.positions ?? ['Server'])
  const [email, setEmail] = useState(employee?.email ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [color, setColor] = useState(employee?.color ?? nextColor(employees.map((e) => e.color)))
  const [active, setActive] = useState(employee?.active ?? true)
  const [isManager, setIsManager] = useState(employee?.role === 'admin')
  const isSelf = !!employee && employee.id === me?.id
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const toggle = (p: Position) =>
    setPositions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))

  const save = async () => {
    setError(null)
    if (!name.trim()) return setError('Name is required')
    if (positions.length === 0) return setError('Pick at least one position')
    const input: EmployeeInput = {
      name: name.trim(),
      positions,
      email: email.trim().toLowerCase() || null,
      phone: phone.trim() || null,
      color,
      active,
      role: isManager ? 'admin' : 'employee',
    }
    setBusy(true)
    try {
      if (employee) await updateEmployee(employee.id, input)
      else await createEmployee(input)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!employee || !confirm(`Remove ${employee.name}? Their shifts will become open.`)) return
    setBusy(true)
    try {
      await deleteEmployee(employee.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={employee ? 'Edit employee' : 'Add employee'}
      onClose={onClose}
      footer={
        <>
          {employee && (
            <button className="btn-ghost mr-auto text-red-600" onClick={remove} disabled={busy}>
              <Trash2 size={16} /> Remove
            </button>
          )}
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {employee ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Positions</label>
          <div className="flex flex-wrap gap-2">
            {orgPositions.map((p) => {
              const on = positions.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggle(p)}
                  className={`chip border px-3 py-1 ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Used to link their login" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ring-offset-2 ${color === c ? 'ring-2 ring-slate-900' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isManager} disabled={isSelf} onChange={(e) => setIsManager(e.target.checked)} />
          Manager (can edit the schedule, team and all offers)
          {isSelf && <span className="text-xs text-slate-400">— you can't change your own access</span>}
        </label>
        {employee && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (inactive staff are hidden from pickers)
          </label>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
