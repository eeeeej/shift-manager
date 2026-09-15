import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Profile } from '../types'
import { isDemoMode, supabase } from '../lib/supabase'
import { SEED_EMPLOYEES } from '../data/seed'

export interface AuthApi {
  user: Profile | null
  loading: boolean
  signIn(email: string, password: string): Promise<void>
  /** Starts registration; the account is created once the emailed OTP is verified. */
  signUp(email: string, password: string, fullName: string): Promise<void>
  verifyOtp(email: string, token: string): Promise<void>
  signInWithGoogle(): Promise<void>
  signInWithApple(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>
  /** Demo-only: accounts you can log in with. */
  demoAccounts: { email: string; label: string; role: Profile['role'] }[]
}

const AuthContext = createContext<AuthApi | null>(null)

// ---------------------------------------------------------------------------
// Demo auth (no Supabase configured)
// ---------------------------------------------------------------------------
const DEMO_SESSION_KEY = 'shift-manager:demo:session'
const DEMO_ACCOUNTS_KEY = 'shift-manager:demo:accounts'
export const DEMO_PASSWORD = 'password'
export const DEMO_OTP = '123456'

interface DemoAccount {
  id: string
  email: string
  password: string
  fullName: string
  role: Profile['role']
}

function seedDemoAccounts(): DemoAccount[] {
  return [
    { id: 'user-owner', email: 'owner@example.com', password: DEMO_PASSWORD, fullName: 'Owner', role: 'admin' },
    ...SEED_EMPLOYEES.map((e) => ({
      id: `user-${e.id}`,
      email: e.email!,
      password: DEMO_PASSWORD,
      fullName: e.name,
      role: 'employee' as const,
    })),
  ]
}

function readDemoAccounts(): DemoAccount[] {
  const raw = localStorage.getItem(DEMO_ACCOUNTS_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as DemoAccount[]
    } catch {
      /* reseed */
    }
  }
  const seeded = seedDemoAccounts()
  localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(seeded))
  return seeded
}

function writeDemoAccounts(accounts: DemoAccount[]) {
  localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts))
}

const toProfile = (a: DemoAccount): Profile => ({ id: a.id, email: a.email, role: a.role, fullName: a.fullName })

function useDemoAuth(): AuthApi {
  const [user, setUser] = useState<Profile | null>(() => {
    const raw = localStorage.getItem(DEMO_SESSION_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  })
  const [pending, setPending] = useState<DemoAccount | null>(null)

  const setSession = (p: Profile | null) => {
    if (p) localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(p))
    else localStorage.removeItem(DEMO_SESSION_KEY)
    setUser(p)
  }

  const demoAccounts = useMemo(
    () => readDemoAccounts().map((a) => ({ email: a.email, label: a.fullName, role: a.role })),
    [],
  )

  return {
    user,
    loading: false,
    demoAccounts,
    async signIn(email, password) {
      const acct = readDemoAccounts().find((a) => a.email.toLowerCase() === email.toLowerCase())
      if (!acct || acct.password !== password) throw new Error('Invalid email or password')
      setSession(toProfile(acct))
    },
    async signUp(email, password, fullName) {
      if (readDemoAccounts().some((a) => a.email.toLowerCase() === email.toLowerCase()))
        throw new Error('An account with that email already exists')
      setPending({ id: `user-${Date.now()}`, email: email.toLowerCase(), password, fullName, role: 'employee' })
    },
    async verifyOtp(email, token) {
      if (token !== DEMO_OTP) throw new Error(`Invalid code (demo code is ${DEMO_OTP})`)
      const acct = pending?.email === email.toLowerCase() ? pending : readDemoAccounts().find((a) => a.email === email.toLowerCase())
      if (!acct) throw new Error('No pending registration for that email')
      const accounts = readDemoAccounts()
      if (!accounts.some((a) => a.id === acct.id)) writeDemoAccounts([...accounts, acct])
      setPending(null)
      setSession(toProfile(acct))
    },
    async signInWithGoogle() {
      throw new Error('Google sign-in requires a Supabase project (demo mode)')
    },
    async signInWithApple() {
      throw new Error('Apple sign-in requires a Supabase project (demo mode)')
    },
    async requestPasswordReset(email) {
      if (!readDemoAccounts().some((a) => a.email === email.toLowerCase())) throw new Error('No account with that email')
      setPending(readDemoAccounts().find((a) => a.email === email.toLowerCase()) ?? null)
    },
    async updatePassword(password) {
      const target = user ?? (pending ? toProfile(pending) : null)
      if (!target) throw new Error('Not signed in')
      const accounts = readDemoAccounts().map((a) => (a.id === target.id ? { ...a, password } : a))
      writeDemoAccounts(accounts)
      setPending(null)
      setSession(target)
    },
    async signOut() {
      setSession(null)
    },
  }
}

// ---------------------------------------------------------------------------
// Supabase auth
// ---------------------------------------------------------------------------
function useSupabaseAuth(): AuthApi {
  const client = supabase!
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(
    async (userId: string | undefined) => {
      if (!userId) {
        setUser(null)
        setLoading(false)
        return
      }
      const { data } = await client.from('profiles').select('id, email, role, full_name').eq('id', userId).single()
      setUser(data ? { id: data.id, email: data.email, role: data.role, fullName: data.full_name } : null)
      setLoading(false)
    },
    [client],
  )

  useEffect(() => {
    client.auth.getSession().then(({ data }) => loadProfile(data.session?.user.id))
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [client, loadProfile])

  const redirectTo = `${window.location.origin}/auth/callback`

  return {
    user,
    loading,
    demoAccounts: [],
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    },
    async signUp(email, password, fullName) {
      const { error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: redirectTo },
      })
      if (error) throw new Error(error.message)
    },
    async verifyOtp(email, token) {
      const { error } = await client.auth.verifyOtp({ email, token, type: 'signup' })
      if (error) throw new Error(error.message)
    },
    async signInWithGoogle() {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      if (error) throw new Error(error.message)
    },
    async signInWithApple() {
      const { error } = await client.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo } })
      if (error) throw new Error(error.message)
    },
    async requestPasswordReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw new Error(error.message)
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password })
      if (error) throw new Error(error.message)
    },
    async signOut() {
      await client.auth.signOut()
    },
  }
}

const useAuthImpl = isDemoMode ? useDemoAuth : useSupabaseAuth

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useAuthImpl()
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
