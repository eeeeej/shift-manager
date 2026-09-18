import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Membership, Profile, Role } from '../types'
import { isDemoMode, supabase } from '../lib/supabase'
import { SEED_EMPLOYEES } from '../data/seed'
import { isInvitedDemoEmail } from '../data/mockStore'

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
  demoAccounts: { email: string; label: string; role: Role }[]
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
  role: Role
}

function seedDemoAccounts(): DemoAccount[] {
  return [
    { id: 'user-owner', email: 'owner@example.com', password: DEMO_PASSWORD, fullName: 'Owner', role: 'owner' },
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
      return (JSON.parse(raw) as DemoAccount[]).map((a) => (a.id === 'user-owner' ? { ...a, role: 'owner' } : a))
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

/** Demo-only: mirror an employee's role onto their login (and live session). */
export function setDemoAccountRole(email: string, role: Role) {
  const accounts = readDemoAccounts().map((a) => (a.email.toLowerCase() === email.toLowerCase() ? { ...a, role } : a))
  writeDemoAccounts(accounts)
}

// Demo mode has one organization (see mockStore DEMO_ORG); the id is repeated
// here to avoid a circular import.
const DEMO_ORG_ID = 'org-demo'
const toProfile = (a: DemoAccount): Profile => ({
  id: a.id,
  email: a.email,
  fullName: a.fullName,
  isSuperadmin: a.id === 'user-owner',
  memberships: [{ orgId: DEMO_ORG_ID, role: a.role }],
})

function useDemoAuth(): AuthApi {
  const [user, setUser] = useState<Profile | null>(() => {
    const raw = localStorage.getItem(DEMO_SESSION_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<DemoAccount>
    const acct = readDemoAccounts().find((a) => a.id === saved.id)
    return acct ? toProfile(acct) : null
  })
  const [pending, setPending] = useState<DemoAccount | null>(null)

  const setSession = (a: DemoAccount | null) => {
    if (a) localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ id: a.id, email: a.email }))
    else localStorage.removeItem(DEMO_SESSION_KEY)
    setUser(a ? toProfile(a) : null)
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
      setSession(acct)
    },
    async signUp(email, password, fullName) {
      if (readDemoAccounts().some((a) => a.email.toLowerCase() === email.toLowerCase()))
        throw new Error('An account with that email already exists')
      if (!isInvitedDemoEmail(email))
        throw new Error('This email has not been invited. Ask a manager to add you on the Team page with this address.')
      setPending({ id: `user-${Date.now()}`, email: email.toLowerCase(), password, fullName, role: 'employee' })
    },
    async verifyOtp(email, token) {
      if (token !== DEMO_OTP) throw new Error(`Invalid code (demo code is ${DEMO_OTP})`)
      const acct = pending?.email === email.toLowerCase() ? pending : readDemoAccounts().find((a) => a.email === email.toLowerCase())
      if (!acct) throw new Error('No pending registration for that email')
      const accounts = readDemoAccounts()
      if (!accounts.some((a) => a.id === acct.id)) writeDemoAccounts([...accounts, acct])
      setPending(null)
      setSession(acct)
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
      const targetId = user?.id ?? pending?.id
      if (!targetId) throw new Error('Not signed in')
      const accounts = readDemoAccounts().map((a) => (a.id === targetId ? { ...a, password } : a))
      writeDemoAccounts(accounts)
      setPending(null)
      setSession(accounts.find((a) => a.id === targetId) ?? null)
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
      const [{ data }, { data: mems }] = await Promise.all([
        client.from('profiles').select('id, email, full_name, is_superadmin').eq('id', userId).single(),
        client.from('memberships').select('org_id, role').eq('user_id', userId),
      ])
      const memberships: Membership[] = ((mems ?? []) as { org_id: string; role: Role }[]).map((m) => ({
        orgId: m.org_id,
        role: m.role,
      }))
      setUser(
        data
          ? { id: data.id, email: data.email, fullName: data.full_name, isSuperadmin: data.is_superadmin, memberships }
          : null,
      )
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
