'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient()
  const { showToast } = useToast()
  const router = useRouter()
  const search = useSearchParams()

  const next = search.get('next') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // If already logged in, go to dashboard
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next)
    })
  }, [router, next, supabase])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        showToast('success', 'Account created ✅ You can now sign in.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        showToast('success', 'Signed in ✅')
        router.replace(next)
      }
    } catch (err: any) {
      showToast('error', err?.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white shadow-sm p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="text-sm text-gray-500">
            {mode === 'signin' ? 'Access your expenses securely.' : 'Create an account to start tracking expenses.'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-black text-white py-3 text-[16px] font-medium disabled:opacity-50"
            type="submit"
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="text-sm text-gray-600">
          {mode === 'signin' ? (
            <button className="text-blue-600" onClick={() => setMode('signup')} type="button">
              Need an account? Sign up
            </button>
          ) : (
            <button className="text-blue-600" onClick={() => setMode('signin')} type="button">
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
