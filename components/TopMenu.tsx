'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function TopMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b px-6 py-3 flex justify-between items-center">
      <div className="font-semibold">Expense Tracker</div>

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="border px-3 py-1 rounded text-sm"
        >
          Menu ▾
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-40 border rounded bg-white shadow">
            <Link
              href="/"
              className="block px-4 py-2 hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>

            <Link
              href="/expenses"
              className="block px-4 py-2 hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              Expenses
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
