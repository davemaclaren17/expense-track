'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/currency'

type ReceiptStatus = 'Pending' | 'Approved' | 'Rejected' | 'Reimbursed'

type ExpenseRow = {
  id: string
  title: string
  merchant: string | null
  amount: number
  currency: string
  category: string
  country: string
  expense_date: string
  receipt_status: ReceiptStatus
}

function statusPillClass(status: ReceiptStatus) {
  switch (status) {
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'Approved':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'Rejected':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'Reimbursed':
      return 'bg-teal-50 text-teal-700 border-teal-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function startOfMonthISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export default function DashboardPage() {
  const supabase = createSupabaseBrowserClient()

  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)

    const { data } = await supabase
      .from('expenses')
      .select('id,title,merchant,amount,currency,category,country,expense_date,receipt_status')
      .order('expense_date', { ascending: false })

    if (data) setExpenses(data as ExpenseRow[])
    setLoading(false)
  }

  const totalsByStatus = useMemo(() => {
    const out: Record<ReceiptStatus, number> = {
      Pending: 0,
      Approved: 0,
      Rejected: 0,
      Reimbursed: 0,
    }

    for (const e of expenses) {
      out[e.receipt_status] += Number(e.amount || 0)
    }

    return out
  }, [expenses])

  const monthTotal = useMemo(() => {
    const start = startOfMonthISO()
    return expenses
      .filter(e => e.expense_date >= start)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [expenses])

  const allTimeTotal = useMemo(() => {
    return expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [expenses])

  const recent = expenses.slice(0, 5)

  return (
    <div className="app-page space-y-5">
      {/* Title */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f97363]">Expense overview</p>
        <h1 className="section-title">Dashboard</h1>
        <p className="section-subtitle">
          Overview of your expenses
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Link
          href="/expenses"
          className="btn-primary flex-1 py-3"
        >
          View expenses
        </Link>
        <Link
          href="/expenses"
          className="btn-accent flex-1 py-3"
        >
          Add expense
        </Link>
      </div>

      {/* Totals */}
      <div className="app-card overflow-hidden">
        <div className="bg-[#172554] px-5 py-4 text-white">
          <p className="text-sm text-white/70">This month</p>
          <p className="text-3xl font-semibold tracking-tight">
            {formatMoney(monthTotal, 'GBP')}
          </p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-[#dbe3ef]">
          <div>
            <div className="p-4">
              <p className="text-sm text-[#667085]">All time</p>
              <p className="text-lg font-semibold text-[#172554]">
                {formatMoney(allTimeTotal, 'GBP')}
              </p>
            </div>
          </div>
          <div>
            <div className="p-4">
              <p className="text-sm text-[#667085]">Entries</p>
              <p className="text-lg font-semibold text-[#172554]">
                {expenses.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(totalsByStatus) as ReceiptStatus[]).map(status => (
          <div
            key={status}
            className="app-card-muted p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs border px-2 py-0.5 rounded-full ${statusPillClass(status)}`}>
                {status}
              </span>
            </div>
            <p className="font-semibold">
              {formatMoney(totalsByStatus[status], 'GBP')}
            </p>
          </div>
        ))}
      </div>

      {/* Recent expenses */}
      <div className="app-card">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#172554]">Recent expenses</h2>
            <p className="text-sm text-[#667085]">Last 5 entries</p>
          </div>
          <Link href="/expenses" className="text-sm font-medium text-[#f97363]">
            See all
          </Link>
        </div>

        {loading && (
          <p className="px-4 pb-4 text-sm text-[#667085]">Loading…</p>
        )}

        {!loading && recent.length === 0 && (
          <p className="px-4 pb-4 text-sm text-[#667085]">
            No expenses yet.
          </p>
        )}

        {!loading && recent.length > 0 && (
          <div className="divide-y divide-[#edf1f7]">
            {recent.map(e => (
              <div
                key={e.id}
                className="px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate text-[#172554]">{e.title}</p>
                    <span className={`text-xs border px-2 py-0.5 rounded-full ${statusPillClass(e.receipt_status)}`}>
                      {e.receipt_status}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] mt-1">
                    {e.merchant ? `${e.merchant} · ` : ''}
                    {e.category} · {e.expense_date}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-semibold text-[#172554]">
                    {formatMoney(e.amount, e.currency)}
                  </p>
                  <p className="text-xs text-[#667085]">
                    {e.country}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
