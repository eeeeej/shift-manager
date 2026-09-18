import { Bell, Book, Check, Copy, Printer, Share } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../data/DataContext'
import { orgLabel } from '../lib/brand'
import { isStandalone, isWrongBrowser, platform, promptInstall, useInstallPrompt, type Platform } from '../lib/install'

type Tab = Exclude<Platform, 'other'>

function Step({ n, done, children }: { n: number; done?: boolean; children: ReactNode }) {
  return (
    <li className="card flex gap-3 p-4">
      <span
        className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-sm font-bold text-white ${done ? 'bg-emerald-500' : 'bg-[var(--accent)]'}`}
        aria-label={done ? `Step ${n} done` : `Step ${n}`}
      >
        {done ? <Check size={16} strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 text-[15px] leading-snug">{children}</div>
    </li>
  )
}

function Row({ children, highlight }: { children: ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm ${highlight ? 'border-amber-400 ring-2 ring-amber-300' : 'border-slate-200'}`}>
      {children}
    </div>
  )
}

/** Illustrated, platform-aware "Add to Home Screen" walkthrough. Public so it can be texted around. */
export function Install() {
  const { user } = useAuth()
  const { org } = useData()
  const [tab, setTab] = useState<Tab>(() => (platform() === 'android' ? 'android' : 'ios'))
  const [copied, setCopied] = useState(false)
  const prompt = useInstallPrompt()
  const installed = isStandalone()
  const wrongBrowser = !installed && isWrongBrowser()
  const name = orgLabel(org)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copy this link', window.location.href)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        {org?.brand.logoUrl ? (
          <img src={org.brand.logoUrl} alt="" className="h-7 max-w-[200px] object-contain" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">S</span>
        )}
        <span className="font-semibold">{name}</span>
        <Link to={user ? '/' : '/login'} className="ml-auto text-sm text-slate-600 hover:underline print:hidden">
          {user ? 'Back' : 'Sign in'}
        </Link>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        <h1 className="text-2xl font-semibold">Add {org ? `${name} schedule` : name} to your home screen</h1>
        <p className="mt-1 text-sm text-slate-600">
          Takes about 30 seconds. Once added it opens like an app and can send you shift notifications.
        </p>

        {installed && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <Check size={16} /> Already installed — you're using the app right now.
          </div>
        )}

        <div className="mt-5 flex rounded-lg bg-slate-200 p-0.5 text-sm font-medium print:hidden">
          {(['ios', 'android'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            >
              {t === 'ios' ? 'iPhone' : 'Android'}
            </button>
          ))}
        </div>

        {wrongBrowser && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm print:hidden">
            <div className="font-semibold">{tab === 'ios' ? "You're not in Safari" : "You're not in Chrome"}</div>
            <p className="mt-1 text-slate-700">
              This page opened inside another app, which can't install apps. Copy the link, paste it into{' '}
              {tab === 'ios' ? 'Safari' : 'Chrome'}, then follow the steps.
            </p>
            <button className="btn-primary mt-3 px-3 py-1.5 text-sm" onClick={copyLink}>
              <Copy size={14} /> {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        )}

        {tab === 'ios' ? (
          <ol className="mt-4 space-y-3">
            <Step n={1} done={Boolean(user) && !wrongBrowser && platform() === 'ios'}>
              Open this page in <b>Safari</b> and sign in.
            </Step>
            <Step n={2}>
              Tap <b>Share</b>.
              <div className="mt-2 flex items-center gap-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                <Share size={26} strokeWidth={1.75} className="flex-shrink-0 text-[#007aff]" />
                <div>
                  The square with an arrow pointing up, in the bar at the bottom of the screen. Don't see it? Tap <b>···</b> next to the address bar first — Share is in that menu.
                </div>
              </div>
            </Step>
            <Step n={3}>
              Scroll down and tap <b>Add to Home Screen</b>. If it isn't listed, tap <b>View More</b> first.
              <div className="mt-2 space-y-1.5 rounded-lg bg-slate-100 p-3">
                <Row>
                  Copy <Copy size={16} className="text-slate-500" />
                </Row>
                <Row highlight>
                  <b>Add to Home Screen</b>
                  <span className="grid h-5 w-5 place-items-center rounded border border-slate-500 text-xs font-bold leading-none">+</span>
                </Row>
                <Row>
                  Add Bookmark <Book size={16} className="text-slate-500" />
                </Row>
              </div>
            </Step>
            <Step n={4}>
              Tap <b>Add</b> in the top right.
              <div className="mt-1 text-sm text-slate-500">The {name} icon appears on your home screen — open the app from there from now on.</div>
            </Step>
            <Step n={5}>
              Open the app and turn on <b>Notifications</b> on the dashboard.
              <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <Bell size={14} /> Notifications only work from the installed app, not from Safari.
              </div>
            </Step>
          </ol>
        ) : (
          <ol className="mt-4 space-y-3">
            <Step n={1} done={Boolean(user) && !wrongBrowser && platform() === 'android'}>
              Open this page in <b>Chrome</b> and sign in.
            </Step>
            <Step n={2}>
              {prompt ? (
                <>
                  Tap <b>Install app</b>.
                  <div className="mt-2 print:hidden">
                    <button className="btn-primary" onClick={promptInstall}>
                      Install app
                    </button>
                  </div>
                </>
              ) : (
                <>
                  Tap the Chrome menu <b>⋮</b> (top right), then <b>Add to Home screen</b> or <b>Install app</b>.
                  <div className="mt-2 space-y-1.5 rounded-lg bg-slate-100 p-3">
                    <Row>New tab</Row>
                    <Row highlight>
                      <b>Add to Home screen</b>
                    </Row>
                    <Row>Desktop site</Row>
                  </div>
                </>
              )}
            </Step>
            <Step n={3}>
              Tap <b>Install</b> to confirm. The {name} icon appears on your home screen.
            </Step>
            <Step n={4}>
              Open the app and turn on <b>Notifications</b> on the dashboard.
            </Step>
          </ol>
        )}

        <div className="mt-6 flex items-center justify-between text-sm text-slate-500 print:hidden">
          <span>Stuck? Show this page to a manager.</span>
          <button className="btn-ghost flex items-center gap-1 px-2 py-1" onClick={() => window.print()}>
            <Printer size={14} /> Print
          </button>
        </div>
      </main>
    </div>
  )
}
