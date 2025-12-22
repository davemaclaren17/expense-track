'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function TopMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const linkClass = (path: string) =>
    `block px-4 py-3 text-sm ${
      pathname === path ? 'bg-gray-100 font-medium' : ''
    }`

  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="px-4 py-3 flex justify-between items-center max-w-4xl mx-auto">
        <div className="font-semibold text-lg">Expense Tracker</div>

        <button
          onClick={() => setOpen(!open)}
          className="border px-4 py-2 rounded text-sm"
        >
          ☰
        </button>
      </div>

      {open && (
        <nav className="border-t bg-white">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className={linkClass('/')}
            >
              Dashboard
            </Link>

            <Link
              href="/expenses"
              onClick={() => setOpen(false)}
              className={linkClass('/expenses')}
            >
              Expenses
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
