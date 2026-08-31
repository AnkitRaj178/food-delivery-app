import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { registerRequest } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return '/restaurants'
}

export default function RegisterPage() {
  const token = useAppStore((s) => s.token)
  const setSession = useAppStore((s) => s.setSession)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const redirectTo = useMemo(() => {
    const q = searchParams.get('redirect')
    if (q) {
      try {
        return safeRedirect(decodeURIComponent(q))
      } catch {
        return '/restaurants'
      }
    }
    return '/restaurants'
  }, [searchParams])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (token) {
    return <Navigate to={redirectTo} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { token: newToken, user } = await registerRequest(email, password, name)
      setSession(newToken, user)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
      <p className="mt-2 text-sm text-slate-600">
        You can browse as a guest; we only ask for an account at checkout or profile.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="reg-name" className="text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="reg-email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="reg-password" className="text-sm font-medium text-slate-700">
            Password (min 8 characters)
          </label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-2"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link
          to={`/login?redirect=${encodeURIComponent(redirectTo)}`}
          className="font-medium text-orange-600 underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
