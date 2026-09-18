import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PositionsEditor } from '../components/PositionsEditor'
import { ErrorText, PageHeader } from '../components/ui'
import { useData } from '../data/DataContext'
import { DEFAULT_POSITIONS, slugify, type Position } from '../types'

export function NewOrganization() {
  const { canCreateOrg, loading, createOrganization } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [positions, setPositions] = useState<Position[]>(DEFAULT_POSITIONS)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && !canCreateOrg) return <Navigate to="/" replace />

  const effectiveSlug = slugTouched ? slug : slugify(name)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Give the restaurant a name')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(effectiveSlug)) return setError('Short name may only contain lowercase letters, numbers and dashes')
    setBusy(true)
    setError(null)
    try {
      await createOrganization({ name: name.trim(), slug: effectiveSlug, positions })
      navigate('/settings', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New restaurant" subtitle="Set it up, then add its managers and staff on the Team page." />
      <form onSubmit={submit} className="card grid gap-4 p-4 sm:p-6">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Francie's" autoFocus />
        </div>
        <div>
          <label className="label">Short name</label>
          <input
            className="input font-mono"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase())
            }}
            placeholder="francies"
          />
          <p className="mt-1 text-xs text-slate-500">Used in links; lowercase letters, numbers and dashes.</p>
        </div>
        <div>
          <label className="label">Positions</label>
          <PositionsEditor value={positions} onChange={setPositions} />
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || positions.length === 0}>
            Create restaurant
          </button>
        </div>
      </form>
    </div>
  )
}
