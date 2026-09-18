import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { useData } from './data/DataContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Schedule } from './pages/Schedule'
import { Team } from './pages/Team'
import { NewOrganization } from './pages/NewOrganization'
import { OrgSettings } from './pages/OrgSettings'
import { Offers } from './pages/Offers'
import { Login } from './pages/auth/Login'
import { Register } from './pages/auth/Register'
import { ForgotPassword } from './pages/auth/ForgotPassword'
import { ResetPassword } from './pages/auth/ResetPassword'
import { AuthCallback } from './pages/auth/AuthCallback'
import { Spinner } from './components/ui'

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner full />
  if (!user) return <Navigate to="/login" replace />
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function RequireAdmin() {
  const { isAdmin } = useData()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}

function PublicOnly() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner full />
  return user ? <Navigate to="/" replace /> : <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/new" element={<NewOrganization />} />
        <Route element={<RequireAdmin />}>
          <Route path="/team" element={<Team />} />
          <Route path="/settings" element={<OrgSettings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
