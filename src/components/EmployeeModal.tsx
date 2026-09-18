import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useData } from '../data/DataContext'
import { ROLE_LABEL, type Employee, type EmployeeInput, type Position, type Role, type Unavailability } from '../types'
import { nextColor, PALETTE } from '../utils/colors'
import { WEEKDAYS_LONG, minToTimeInput, timeInputToMin } from '../utils/time'
import { FULL_DAY, describeUnavailability, isFullDay } from '../utils/timeOff'
import { ErrorText, Modal } from './ui'

export function EmployeeModal({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const { employees, me, isOwner, positions: orgPositions, createEmployee, updateEmployee, deleteEmployee } = useData()
  const [name, setName] = useState(employee?.name ?? '')
  const [positions, setPositions] = useState<Position[]>(
    employee?.positions.filter((p) => orgPositions.includes(p)) ?? orgPositions.slice(0, 1),
  )
  const [email, setEmail] = useState(employee?.email ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [color, setColor] = useState(employee?.color ?? nextColor(employees.map((e) => e.color)))
  const [active, setActive] = useState(employee?.active ?? true)
  const [role, setRole] = useState<Role>(employee?.role ?? 'employee')
  const [unavailability, setUnavailability] = useState<Unavailability[]>(employee?.unavailability ?? [])
  const [addingDow, setAddingDow] = useState(2)
  const [addingWindow, setAddingWindow] = useState<{ startMin: number; endMin: number } | null>(null)
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
      role,
      unavailability,
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

  const addUnavailability = () => {
    const w = addingWindow ?? FULL_DAY
    if (w.endMin <= w.startMin) return setError('End time must be after start time.')
    setError(null)
    setUnavailability((prev) =>
      [...prev.filter((u) => !(u.dow === addingDow && isFullDay(w))), { dow: addingDow, ...w }].sort((a, b) => a.dow - b.dow || a.startMin - b.startMin),
    )
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
        <div>
          <label className="label">Access</label>
          <select className="input" value={role} disabled={isSelf || !isOwner} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {isSelf
              ? "You can't change your own access."
              : !isOwner
                ? 'Only an owner can change access.'
                : 'Managers edit the schedule, team and offers; owners also manage settings and access.'}
          </p>
        </div>
        <div>
          <label className="label">Can't work</label>
          {unavailability.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {unavailability.map((u, i) => (
                <li key={i} className="chip inline-flex items-center gap-1 bg-slate-100 text-slate-700">
                  {describeUnavailability(u)}
                  <button
                    type="button"
                    aria-label={`Remove ${describeUnavailability(u)}`}
                    className="-mr-1 rounded p-0.5 hover:bg-slate-200"
                    onClick={() => setUnavailability((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto" value={addingDow} onChange={(e) => setAddingDow(Number(e.target.value))} aria-label="Weekday">
              {WEEKDAYS_LONG.map((d, i) => (
                <option key={d} value={i}>
                  {d}s
                </option>
              ))}
            </select>
            <select
              className="input w-auto"
              value={addingWindow ? 'part' : 'all'}
              onChange={(e) => setAddingWindow(e.target.value === 'all' ? null : { startMin: 10 * 60, endMin: 16 * 60 })}
              aria-label="All day or part"
            >
              <option value="all">all day</option>
              <option value="part">between…</option>
            </select>
            {addingWindow && (
              <>
                <input
                  type="time"
                  className="input w-auto"
                  value={minToTimeInput(addingWindow.startMin)}
                  onChange={(e) => setAddingWindow({ ...addingWindow, startMin: timeInputToMin(e.target.value) })}
                  aria-label="From"
                />
                <input
                  type="time"
                  className="input w-auto"
                  value={minToTimeInput(addingWindow.endMin)}
                  onChange={(e) => setAddingWindow({ ...addingWindow, endMin: timeInputToMin(e.target.value) })}
                  aria-label="To"
                />
              </>
            )}
            <button type="button" className="btn-secondary" onClick={addUnavailability}>
              <Plus size={14} /> Add
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Recurring every week; shows as “unavailable” on the schedule and warns when scheduling over it.</p>
        </div>
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
