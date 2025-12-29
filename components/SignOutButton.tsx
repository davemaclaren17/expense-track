'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()

  return (
    <button
      className="text-sm rounded-xl border px-3 py-2 bg-white"
      onClick={async () => {
        await supabase.auth.signOut()
        router.replace('/login')
      }}
      type="button"
    >
      Sign out
    </button>
  )
}
