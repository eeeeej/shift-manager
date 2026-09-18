import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PositionsEditor } from '../components/PositionsEditor'
import { ErrorText, PageHeader, Spinner, WarnText } from '../components/ui'
import { useData } from '../data/DataContext'
import { DEFAULT_ACCENT } from '../lib/brand'
import { processBrandImage, type BrandImages } from '../lib/brandImage'
import type { Position } from '../types'

type IconBg = 'white' | 'accent'

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
  const { org, employees, shifts, updateOrganization, uploadBrandImage } = useData()
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [accent, setAccent] = useState(DEFAULT_ACCENT)
  const [useAccent, setUseAccent] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [iconBg, setIconBg] = useState<IconBg>('white')
  const [pending, setPending] = useState<BrandImages | null>(null)
  const [preview, setPreview] = useState<{ logo: string; icon: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
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
    setIconUrl(org.brand.iconUrl ?? '')
    setFile(null)
    setPending(null)
    setTimezone(org.timezone)
    setPositions(org.positions)
  }, [org])

  const bgColor = iconBg === 'accent' && useAccent ? accent : '#ffffff'
  useEffect(() => {
    if (!file) {
      setPending(null)
      setPreview(null)
      return
    }
    let live = true
    processBrandImage(file, bgColor)
      .then((imgs) => {
        if (!live) return
        setPending(imgs)
        setPreview({ logo: URL.createObjectURL(imgs.logo), icon: URL.createObjectURL(imgs.icon) })
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [file, bgColor])
  useEffect(
    () => () => {
      if (preview) {
        URL.revokeObjectURL(preview.logo)
        URL.revokeObjectURL(preview.icon)
      }
    },
    [preview],
  )

  if (!org) return <Spinner full />

  const removed = org.positions.filter((p) => !positions.includes(p))
  const inUse = removed.filter((p) => employees.some((e) => e.positions.includes(p)) || shifts.some((s) => s.position === p))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Name is too short')
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      let logo = logoUrl
      let icon = iconUrl
      if (pending) {
        ;[logo, icon] = await Promise.all([uploadBrandImage('logo', pending.logo), uploadBrandImage('icon', pending.icon)])
        setLogoUrl(logo)
        setIconUrl(icon)
        setFile(null)
      }
      await updateOrganization({
        name: name.trim(),
        timezone,
        positions,
        brand: {
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          ...(useAccent ? { accentColor: accent } : {}),
          ...(logo ? { logoUrl: logo } : {}),
          ...(icon ? { iconUrl: icon } : {}),
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
            <label className="label">Logo (optional)</label>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-16 min-w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2" title="Header">
                {preview?.logo || logoUrl ? <img src={preview?.logo ?? logoUrl} alt="" className="max-h-12 max-w-[200px] object-contain" /> : <ImagePlus className="text-slate-300" />}
              </div>
              <img src={preview?.icon ?? (iconUrl || '/pwa-192.png')} alt="" className="h-16 w-16 rounded-2xl border border-slate-200 object-cover" title="Home-screen icon" />
              <div className="flex flex-col gap-1.5">
                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => fileInput.current?.click()}>
                  {logoUrl || file ? 'Replace image…' : 'Upload image…'}
                </button>
                {(logoUrl || file) && (
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs text-rose-700"
                    onClick={() => {
                      setFile(null)
                      setLogoUrl('')
                      setIconUrl('')
                      if (fileInput.current) fileInput.current.value = ''
                    }}
                  >
                    <Trash2 size={12} className="mr-1 inline" /> Remove
                  </button>
                )}
              </div>
            </div>
            {file && (
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                Icon background:
                <label className="flex items-center gap-1">
                  <input type="radio" name="iconbg" checked={iconBg === 'white'} onChange={() => setIconBg('white')} /> White
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" name="iconbg" checked={iconBg === 'accent'} onChange={() => setIconBg('accent')} disabled={!useAccent} /> Accent colour
                </label>
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Any shape works — PNG with a transparent background looks best. The header shows it as-is; the square version becomes the icon staff see after “Add to Home
              Screen”.
            </p>
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
