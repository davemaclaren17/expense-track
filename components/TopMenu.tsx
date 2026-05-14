'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function TopMenu() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

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
    <header className="sticky top-0 z-40 border-b border-[#dbe3ef] bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-lg tracking-tight text-[#172554]">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[#172554] text-sm text-white shadow-sm">
            £
          </span>
          <span>Expense Tracker</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 text-sm text-[#344054]">
          {!user && (
            <Link
              href="/login"
              className="btn-secondary px-3 py-2"
            >
              Login
            </Link>
          )}

          {user && (
            <>
              <Link
                href="/dashboard"
                className={pathname === '/dashboard' ? 'font-semibold nav-link-active' : 'hover:text-[#172554]'}
              >
                Dashboard
              </Link>

              <Link
                href="/expenses"
                className={pathname === '/expenses' ? 'font-semibold nav-link-active' : 'hover:text-[#172554]'}
              >
                Expenses
              </Link>

              <button
                onClick={signOut}
                className="btn-secondary px-3 py-2"
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
