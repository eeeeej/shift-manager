import { Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { orgLabel } from '../lib/brand'
import { isSnoozed, isStandalone, platform, promptInstall, snooze, useInstallPrompt } from '../lib/install'

/** Nudges phone users to add the app to their home screen; links to the guided /install page. */
export function InstallBanner() {
  const { org } = useData()
  const [snoozed, setSnoozed] = useState(isSnoozed)
  const prompt = useInstallPrompt()

  if (snoozed || isStandalone() || platform() === 'other') return null
  const icon = org?.brand.iconUrl ?? '/pwa-192.png'

  return (
    <div className="mx-auto mb-3 flex max-w-7xl items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm md:hidden short:hidden">
      <img src={icon} alt="" className="h-10 w-10 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Get the {orgLabel(org)} app</div>
        <div className="text-xs text-slate-500">Add it to your home screen for one-tap access and notifications.</div>
      </div>
      {prompt ? (
        <button className="btn-primary px-3 py-1.5 text-xs" onClick={promptInstall}>
          Install
        </button>
      ) : (
        <Link to="/install" className="btn-primary px-3 py-1.5 text-xs">
          <Smartphone size={14} /> Show me how
        </Link>
      )}
      <button
        className="btn-ghost px-2 py-1.5 text-xs text-slate-500"
        onClick={() => {
          snooze()
          setSnoozed(true)
        }}
      >
        Not now
      </button>
    </div>
  )
}
