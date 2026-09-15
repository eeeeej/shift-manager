import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ErrorText } from '../../components/ui'
import { isDemoMode } from '../../lib/supabase'
import { AuthShell } from './AuthShell'

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
      if (isDemoMode) navigate('/reset-password')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="We'll email you a link to choose a new password.">
      {sent ? (
        <p className="text-sm text-slate-700">Check {email} for a reset link.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <ErrorText>{error}</ErrorText>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            Send reset link
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-slate-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}
