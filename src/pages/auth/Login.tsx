import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DEMO_PASSWORD, useAuth } from '../../auth/AuthContext'
import { ErrorText } from '../../components/ui'
import { isDemoMode } from '../../lib/supabase'
import { AuthShell, OAuthButtons } from './AuthShell'

export function Login() {
  const { signIn, signInWithGoogle, signInWithApple, demoAccounts } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() => signIn(email.trim(), password))
  }

  return (
    <AuthShell title="Sign in" subtitle="Staff and owners only.">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <ErrorText>{error}</ErrorText>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          Sign in
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>
      <OAuthButtons onGoogle={() => run(signInWithGoogle)} onApple={() => run(signInWithApple)} disabled={busy} />

      <div className="mt-4 flex justify-between text-sm">
        <Link to="/forgot-password" className="text-slate-600 hover:underline">
          Forgot password?
        </Link>
        <Link to="/register" className="text-slate-600 hover:underline">
          Create account
        </Link>
      </div>

      {isDemoMode && (
        <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-2 font-medium">Demo logins (password: {DEMO_PASSWORD})</p>
          <div className="flex flex-wrap gap-1">
            {demoAccounts.slice(0, 6).map((a) => (
              <button
                key={a.email}
                type="button"
                className={`chip border ${a.role !== 'employee' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
                onClick={() => run(() => signIn(a.email, DEMO_PASSWORD))}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  )
}
