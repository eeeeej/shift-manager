import { X } from 'lucide-react'
import { useState } from 'react'
import type { Position } from '../types'

/** Ordered list of position names with add/remove; used for restaurant setup and settings. */
export function PositionsEditor({ value, onChange }: { value: Position[]; onChange: (next: Position[]) => void }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const p = draft.trim()
    if (!p) return
    if (!value.some((v) => v.toLowerCase() === p.toLowerCase())) onChange([...value, p])
    setDraft('')
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {value.map((p) => (
          <span key={p} className="chip border border-slate-300 bg-white py-1 pl-3 pr-1 text-slate-700">
            {p}
            <button
              type="button"
              className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onChange(value.filter((v) => v !== p))}
              aria-label={`Remove ${p}`}
              disabled={value.length === 1}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Add a position"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn-secondary" onClick={add} disabled={!draft.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}
