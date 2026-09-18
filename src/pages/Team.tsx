import { Link2, Mail, Pencil, Phone, Plus, Send, ShieldCheck, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmployeeModal } from '../components/EmployeeModal'
import { Avatar, EmptyState, PageHeader } from '../components/ui'
import { useData } from '../data/DataContext'
import { installUrl } from '../lib/install'
import { isManagerRole, type AccountStatus, type Employee } from '../types'

const lastSeen = (iso: string) => {
  const d = new Date(iso)
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((midnight(new Date()) - midnight(d)) / 86_400_000)
  if (days === 0) return `today ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  if (days === 1) return 'yesterday'
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function Team() {
  const { employees, inviteEmployee, accountStatus, org, isAdmin } = useData()
  const [editing, setEditing] = useState<Employee | null | 'new'>(null)
  const [status, setStatus] = useState<Map<string, AccountStatus>>(new Map())
  useEffect(() => {
    if (!isAdmin || !org) return
    let live = true
    accountStatus()
      .then((rows) => live && setStatus(new Map(rows.map((r) => [r.employeeId, r]))))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [isAdmin, org, employees, accountStatus])
  const [showInactive, setShowInactive] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const list = employees
    .filter((e) => showInactive || e.active)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }
  /** Invite link to paste into a text/group chat; pre-fills the signup form. */
  const copyInviteLink = async (e: Employee) => {
    const url = new URL('/register', window.location.origin)
    if (e.email) url.searchParams.set('email', e.email)
    url.searchParams.set('name', e.name)
    if (org) url.searchParams.set('org', org.brand.displayName || org.name)
    try {
      await navigator.clipboard.writeText(url.toString())
      flash(`Invite link for ${e.name} copied — paste it into a text`)
    } catch {
      prompt('Copy this invite link', url.toString())
    }
  }
  const copyInstallLink = async () => {
    try {
      await navigator.clipboard.writeText(installUrl())
      flash('Install instructions link copied — text it to staff')
    } catch {
      prompt('Copy this link', installUrl())
    }
  }
  const invite = async (e: Employee) => {
    try {
      await inviteEmployee(e.id)
      flash(`Invite emailed to ${e.email}`)
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={`${employees.filter((e) => e.active).length} active staff · ${employees.filter((e) => e.active && isManagerRole(e.role)).length} managers`}
        actions={
          <>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
            <button className="btn-secondary" onClick={copyInstallLink} title="Copy a link to the add-to-home-screen instructions">
              <Smartphone size={16} /> <span className="hidden sm:inline">Install link</span>
            </button>
            <button className="btn-primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> Employee
            </button>
          </>
        }
      />

      {toast && <div className="mb-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">{toast}</div>}

      {list.length === 0 ? (
        <EmptyState title="No employees yet" hint="Add your staff to start scheduling." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <div key={e.id} className={`card flex gap-3 p-3 ${e.active ? '' : 'opacity-60'}`}>
              <Avatar name={e.name} color={e.color} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{e.name}</span>
                  {isManagerRole(e.role) && (
                    <span className="chip bg-indigo-100 text-indigo-800">
                      <ShieldCheck size={10} className="mr-1" /> {e.role === 'owner' ? 'owner' : 'manager'}
                    </span>
                  )}
                  {(() => {
                    const st = status.get(e.id)
                    if (!e.userId) return <span className="chip bg-slate-100 text-slate-500">no login</span>
                    if (st && !st.confirmedAt)
                      return (
                        <span className="chip bg-amber-100 text-amber-800" title="Registered but hasn't clicked the confirmation email yet">
                          <Mail size={10} className="mr-1" /> unconfirmed
                        </span>
                      )
                    if (st?.lastSeenAt)
                      return (
                        <span className="chip bg-emerald-100 text-emerald-800" title={`Last active ${new Date(st.lastSeenAt).toLocaleString()}`}>
                          <Link2 size={10} className="mr-1" /> active · {lastSeen(st.lastSeenAt)}
                        </span>
                      )
                    return (
                      <span className="chip bg-emerald-100 text-emerald-800" title="Linked to a login">
                        <Link2 size={10} className="mr-1" /> linked
                      </span>
                    )
                  })()}
                  {!e.active && <span className="chip bg-slate-100 text-slate-500">inactive</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {e.positions.map((p) => (
                    <span key={p} className="chip bg-slate-100 text-slate-700">
                      {p}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                  {e.email && (
                    <div className="flex items-center gap-1 truncate">
                      <Mail size={12} /> {e.email}
                    </div>
                  )}
                  {e.phone && (
                    <div className="flex items-center gap-1">
                      <Phone size={12} /> {e.phone}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button className="btn-ghost p-1.5" onClick={() => setEditing(e)} title="Edit">
                  <Pencil size={15} />
                </button>
                {e.email && !e.userId && (
                  <>
                    <button className="btn-ghost p-1.5" onClick={() => invite(e)} title="Email a login invite">
                      <Send size={15} />
                    </button>
                    <button className="btn-ghost p-1.5" onClick={() => copyInviteLink(e)} title="Copy invite link (to text them)">
                      <Link2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <EmployeeModal employee={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
