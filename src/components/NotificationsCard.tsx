import { Bell, BellOff, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePush } from '../hooks/usePush'

const DISMISS_KEY = 'shift-manager:push:dismissed'

function iosNotInstalled(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches
}

/** Push opt-in prompt for the dashboard; shrinks to a one-line status once on. */
export function NotificationsCard() {
  const { user } = useAuth()
  const { state, enable, disable } = usePush(user?.id)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  if (state === 'unavailable' || state === 'busy') return null

  if (state === 'on') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Bell size={12} /> Notifications on this device.
        <button className="underline" onClick={disable}>
          Turn off
        </button>
      </p>
    )
  }

  if (dismissed) return null
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  let body: string
  let action: ReactNode = null
  if (state === 'denied') {
    body = 'Notifications are blocked for this site — allow them in your browser or phone settings, then reload.'
  } else if (state === 'unsupported') {
    if (!iosNotInstalled()) return null
    body = 'On iPhone, add Shifts to your home screen first (Share → Add to Home Screen), then turn on notifications from there.'
  } else {
    body = 'Hear about open shifts you can pick up, when your offer is taken, and when your schedule changes.'
    action = (
      <button className="btn-primary px-3 py-1.5 text-xs" onClick={enable}>
        Turn on
      </button>
    )
  }

  return (
    <div className="card flex items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700">
        {state === 'denied' ? <BellOff size={18} /> : <Bell size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">Notifications</div>
        <div className="text-xs text-slate-500">{body}</div>
      </div>
      {action}
      <button className="btn-ghost p-1.5" onClick={dismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}
