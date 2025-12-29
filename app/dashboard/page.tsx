'use client'

import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/currency'

type Expense = {
  id: string
  amount: number
  currency: string
  receipt_status: 'Pending' | 'Approved' | 'Rejected' | 'Reimbursed'
}

export default function DashboardPage() {
  const supabase = createSupabaseBrowserClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExpenses()
  }, [])

  async function fetchExpenses() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('id, amount, currency, receipt_status')

    if (data) setExpenses(data)
    setLoading(false)
  }

  const totals = useMemo(() => {
    const result = {
      Pending: 0,
      Approved: 0,
      Rejected: 0,
      Reimbursed: 0,
    }

    for (const e of expenses) {
      result[e.receipt_status] += e.amount
    }

    return result
  }, [expenses])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Overview of your expenses
        </p>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && (
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(totals).map(([status, amount]) => (
            <div
              key={status}
              className="rounded-2xl border bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500">{status}</p>
              <p className="text-xl font-semibold">
                {formatMoney(amount, 'GBP')}
              </p>
            </div>
          ))}
        </div>
      )}

      <div>
        <a
          href="/expenses"
          className="inline-block rounded-xl bg-black text-white px-4 py-3 text-sm font-medium"
        >
          View all expenses →
        </a>
      </div>
    </div>
  )
}
