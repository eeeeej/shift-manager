import { Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'shift-manager:install:dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/** Nudges phone users to add the app to their home screen. Hidden once installed or dismissed. */
export function InstallBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setPrompt(null)
    addEventListener('beforeinstallprompt', onPrompt)
    addEventListener('appinstalled', onInstalled)
    return () => {
      removeEventListener('beforeinstallprompt', onPrompt)
      removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (dismissed || isStandalone()) return null
  const ios = isIos()
  if (!ios && !prompt) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="mx-auto mb-3 flex max-w-7xl items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm md:hidden">
      <img src="/pwa-192.png" alt="" className="h-9 w-9 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Add Shifts to your home screen</div>
        <div className="text-xs text-slate-500">
          {ios ? (
            <>
              Tap <Share size={12} className="inline -mt-0.5" /> Share, then “Add to Home Screen”.
            </>
          ) : (
            'Opens like an app, no browser bar.'
          )}
        </div>
      </div>
      {prompt && (
        <button
          className="btn-primary px-3 py-1.5 text-xs"
          onClick={async () => {
            await prompt.prompt()
            const { outcome } = await prompt.userChoice
            if (outcome === 'accepted') setPrompt(null)
          }}
        >
          Install
        </button>
      )}
      <button className="btn-ghost p-1.5" onClick={dismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}
