import { useEffect, useState, type FormEvent } from 'react'
import { PositionsEditor } from '../components/PositionsEditor'
import { ErrorText, PageHeader, Spinner, WarnText } from '../components/ui'
import { useData } from '../data/DataContext'
import { DEFAULT_ACCENT } from '../lib/brand'
import type { Position } from '../types'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

export function OrgSettings() {
  const { org, employees, shifts, updateOrganization } = useData()
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [accent, setAccent] = useState(DEFAULT_ACCENT)
  const [useAccent, setUseAccent] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [timezone, setTimezone] = useState('America/Chicago')
  const [positions, setPositions] = useState<Position[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!org) return
    setName(org.name)
    setDisplayName(org.brand.displayName ?? '')
    setAccent(org.brand.accentColor ?? DEFAULT_ACCENT)
    setUseAccent(Boolean(org.brand.accentColor))
    setLogoUrl(org.brand.logoUrl ?? '')
    setTimezone(org.timezone)
    setPositions(org.positions)
  }, [org])

  if (!org) return <Spinner full />

  const removed = org.positions.filter((p) => !positions.includes(p))
  const inUse = removed.filter((p) => employees.some((e) => e.positions.includes(p)) || shifts.some((s) => s.position === p))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Name is too short')
    if (logoUrl && !/^https:\/\//.test(logoUrl)) return setError('Logo must be an https:// image link')
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await updateOrganization({
        name: name.trim(),
        timezone,
        positions,
        brand: {
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          ...(useAccent ? { accentColor: accent } : {}),
          ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
        },
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Restaurant settings" subtitle={`Short name: ${org.slug}`} />
      <form onSubmit={submit} className="card grid gap-5 p-4 sm:p-6">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <fieldset className="grid gap-3">
          <legend className="label">Branding</legend>
          <div>
            <label className="label">Header name (optional)</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={name} />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useAccent} onChange={(e) => setUseAccent(e.target.checked)} />
              Accent colour
            </label>
            <input
              type="color"
              value={accent}
              onChange={(e) => {
                setAccent(e.target.value)
                setUseAccent(true)
              }}
              className="h-8 w-12 cursor-pointer rounded border border-slate-300"
              aria-label="Accent colour"
            />
            <span className="rounded-lg px-3 py-1 text-sm font-medium text-white" style={{ background: useAccent ? accent : DEFAULT_ACCENT }}>
              Preview
            </span>
          </div>
          <div>
            <label className="label">Logo image link (optional)</label>
            <div className="flex items-center gap-3">
              <input className="input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
              {logoUrl && <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
            </div>
            <p className="mt-1 text-xs text-slate-500">Square works best; shown in place of the “S” tile.</p>
          </div>
        </fieldset>

        <div>
          <label className="label">Positions</label>
          <PositionsEditor value={positions} onChange={setPositions} />
          {inUse.length > 0 && (
            <WarnText className="mt-2">
              {inUse.join(', ')} {inUse.length === 1 ? 'is' : 'are'} still on staff or shifts; existing entries keep the name but it can’t be picked for new ones.
            </WarnText>
          )}
        </div>

        <div>
          <label className="label">Time zone</label>
          <input className="input" list="tz-list" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          <datalist id="tz-list">
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        </div>

        <ErrorText>{error}</ErrorText>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-700">Saved</span>}
          <button type="submit" className="btn-primary" disabled={busy || positions.length === 0}>
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
