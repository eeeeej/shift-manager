import { useData } from '../data/DataContext'
import type { Employee } from '../types'
import { offOn } from '../utils/timeOff'

/** Grey "Anna · off" / "Sam · unavailable" chips for a day (approved time off + recurring unavailability). */
export function OffChips({ date, employees, hideNames, className = '' }: { date: string; employees: Employee[]; hideNames?: boolean; className?: string }) {
  const { timeOff } = useData()
  if (hideNames) return null
  const off = offOn(employees, timeOff, date)
  if (off.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-0.5 ${className}`}>
      {off.map(({ employee, label, kind }) => (
        <span
          key={employee.id}
          title={`${employee.name} · ${label}${kind === 'unavailable' ? ' (recurring)' : ' (approved time off)'}`}
          className={`truncate rounded px-1 text-[10px] leading-4 ${
            kind === 'off' ? 'bg-slate-200 text-slate-600' : 'border border-dashed border-slate-300 text-slate-500'
          }`}
        >
          {employee.name.split(' ')[0]} · {label}
        </span>
      ))}
    </div>
  )
}
