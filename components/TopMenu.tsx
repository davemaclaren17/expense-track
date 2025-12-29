'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function TopMenu() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Initial session check
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  if (loading) return null

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div className="font-semibold text-lg tracking-tight">
          ExpenseTrack
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 text-sm">
          {!user && (
            <Link
              href="/login"
              className="rounded-xl border px-3 py-2"
            >
              Login
            </Link>
          )}

          {user && (
            <>
              <Link
                href="/dashboard"
                className={pathname === '/dashboard' ? 'font-medium' : ''}
              >
                Dashboard
              </Link>

              <Link
                href="/expenses"
                className={pathname === '/expenses' ? 'font-medium' : ''}
              >
                Expenses
              </Link>

              <button
                onClick={signOut}
                className="rounded-xl border px-3 py-2"
                type="button"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
