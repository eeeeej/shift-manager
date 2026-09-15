import type { ReactNode } from 'react'
import { isDemoMode } from '../../lib/supabase'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-base font-bold text-white">S</span>
          <span className="text-lg font-semibold">Shift Manager</span>
        </div>
        <div className="card p-6">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-4">{children}</div>
        </div>
        {isDemoMode && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Demo mode — no Supabase configured. Data lives in this browser only.
          </p>
        )}
      </div>
    </div>
  )
}

export function OAuthButtons({
  onGoogle,
  onApple,
  disabled,
}: {
  onGoogle: () => void
  onApple: () => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className="btn-secondary" onClick={onGoogle} disabled={disabled}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Google
      </button>
      <button type="button" className="btn-secondary" onClick={onApple} disabled={disabled}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M16.37 12.6c.03 2.9 2.54 3.87 2.57 3.88-.02.07-.4 1.38-1.33 2.73-.8 1.17-1.63 2.33-2.94 2.35-1.29.02-1.7-.76-3.17-.76s-1.93.74-3.15.79c-1.27.05-2.23-1.26-3.04-2.42-1.65-2.38-2.9-6.73-1.21-9.66.84-1.46 2.34-2.38 3.97-2.4 1.24-.03 2.41.83 3.17.83.76 0 2.18-1.03 3.68-.88.63.03 2.39.25 3.52 1.91-.09.06-2.1 1.23-2.07 3.63zM13.94 4.7c.67-.81 1.12-1.94.99-3.07-.96.04-2.13.64-2.82 1.45-.62.72-1.16 1.87-1.01 2.97 1.07.08 2.17-.55 2.84-1.35z" />
        </svg>
        Apple
      </button>
    </div>
  )
}
