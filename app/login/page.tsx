'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'

function getNextFromUrl(defaultPath: string) {
  if (typeof window === 'undefined') return defaultPath
  const params = new URLSearchParams(window.location.search)
  const next = params.get('next')

  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return defaultPath
  }

  return next
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient()
  const { showToast } = useToast()
  const router = useRouter()

  const nextPath = useMemo(() => getNextFromUrl('/dashboard'), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    // If already logged in, go straight to dashboard (or next)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace(nextPath)
        router.refresh()
      }
    })
  }, [router, nextPath, supabase])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        showToast('success', 'Account created ✅ Now sign in.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        showToast('success', 'Signed in ✅')
        router.replace(nextPath)
        router.refresh()
      }
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    setGoogleLoading(true)

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })

      if (error) throw error
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err, 'Google sign-in failed'))
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-[78vh] flex items-center justify-center px-4 py-8 bg-[#f6f8fb]">
      <div className="w-full max-w-sm rounded-lg border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_30px_rgba(23,37,84,0.06)] space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#172554] sm:text-2xl">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="text-sm text-[#667085]">
            {mode === 'signin'
              ? 'Access your expenses securely.'
              : 'Create an account to start tracking expenses.'}
          </p>
        </div>

        <button
          disabled={googleLoading || loading}
          className="w-full rounded-md border border-[#dbe3ef] bg-white py-3 text-[16px] font-semibold text-[#172554] shadow-sm disabled:opacity-50 flex items-center justify-center gap-3 transition hover:border-[#f97363]"
          onClick={signInWithGoogle}
          type="button"
        >
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.52z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.24-2.51c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.76-5.58-4.12H3.07v2.6A10 10 0 0 0 12 22z" />
            <path fill="#FBBC05" d="M6.42 13.88a6 6 0 0 1 0-3.76v-2.6H3.07a10 10 0 0 0 0 8.96l3.35-2.6z" />
            <path fill="#EA4335" d="M12 5.98c1.47 0 2.8.5 3.84 1.5l2.86-2.86A9.57 9.57 0 0 0 12 2 10 10 0 0 0 3.07 7.52l3.35 2.6C7.2 7.74 9.4 5.98 12 5.98z" />
          </svg>
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          <span>or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded-md border border-[#dbe3ef] bg-white px-4 py-3 text-[16px] text-[#172554] outline-none transition focus:border-[#f97363] focus:ring-4 focus:ring-[#f97363]/20"
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            className="w-full rounded-md border border-[#dbe3ef] bg-white px-4 py-3 text-[16px] text-[#172554] outline-none transition focus:border-[#f97363] focus:ring-4 focus:ring-[#f97363]/20"
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button
            disabled={loading}
            className="w-full rounded-md bg-[#172554] py-3 text-[16px] font-semibold text-white shadow-sm disabled:opacity-50"
            type="submit"
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="text-sm text-[#667085]">
          {mode === 'signin' ? (
            <button className="font-medium text-[#f97363]" onClick={() => setMode('signup')} type="button">
              Need an account? Sign up
            </button>
          ) : (
            <button className="font-medium text-[#f97363]" onClick={() => setMode('signin')} type="button">
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
