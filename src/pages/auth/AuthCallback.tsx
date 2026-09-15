import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Spinner } from '../../components/ui'

/** Landing route for OAuth / magic-link redirects; waits for the session then goes home. */
export function AuthCallback() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!loading) navigate(user ? '/' : '/login', { replace: true })
  }, [user, loading, navigate])
  return <Spinner full />
}
