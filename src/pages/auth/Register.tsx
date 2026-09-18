import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DEMO_OTP, useAuth } from '../../auth/AuthContext'
import { ErrorText } from '../../components/ui'
import { isDemoMode } from '../../lib/supabase'
import { AuthShell, OAuthButtons } from './AuthShell'

export function Register() {
  const { signUp, verifyOtp, signInWithGoogle, signInWithApple } = useAuth()
  const [params] = useSearchParams()
  const invited = params.get('email')?.trim() ?? ''
  const orgName = params.get('org')?.trim() ?? ''
  const [step, setStep] = useState<'details' | 'otp'>('details')
  const [name, setName] = useState(params.get('name')?.trim() ?? '')
  const [email, setEmail] = useState(invited)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
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

  const submitDetails = (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Password must be at least 8 characters')
    run(async () => {
      await signUp(email.trim(), password, name.trim())
      setStep('otp')
    })
  }

  const submitOtp = (e: FormEvent) => {
    e.preventDefault()
    run(() => verifyOtp(email.trim(), code.trim()))
  }

  if (step === 'otp') {
    return (
      <AuthShell
        title="Check your email"
        subtitle={
          isDemoMode
            ? `We sent a 6-digit code to ${email}.`
            : `We sent a confirmation link to ${email}. Click it to finish signing up — or, if the email contains a code, enter it below.`
        }
      >
        <form onSubmit={submitOtp} className="space-y-3">
          <div>
            <label className="label">Verification code</label>
            <input
              className="input text-center text-xl tracking-[0.4em]"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            {isDemoMode && <p className="mt-1 text-xs text-slate-500">Demo code: {DEMO_OTP}</p>}
          </div>
          <ErrorText>{error}</ErrorText>
          <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6}>
            Verify &amp; sign in
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep('details')}>
            Back
          </button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={orgName ? `Join ${orgName}` : 'Create account'}
      subtitle={
        invited
          ? `Your manager${orgName ? ` at ${orgName}` : ''} invited you — just pick a password (or continue with Google).`
          : 'Use the email your manager has on file. Only invited emails can create an account.'
      }
    >
      <form onSubmit={submitDetails} className="space-y-3">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
        </div>
        <ErrorText>{error}</ErrorText>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          Continue
        </button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>
      <OAuthButtons onGoogle={() => run(signInWithGoogle)} onApple={() => run(signInWithApple)} disabled={busy} />
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
