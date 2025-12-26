'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types/expense'
import { formatMoney } from '@/lib/currency'
import Link from 'next/link'


type Totals = {
  [currency: string]: number
}

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExpenses()
  }, [])

  async function fetchExpenses() {
    setLoading(true)

    const { data } = await supabase
      .from('expenses')
      .select('*')

    if (data) {
      setExpenses(data)
    }

    setLoading(false)
  }

  function totalsByCurrency(filter?: (e: Expense) => boolean): Totals {
    return expenses
      .filter(e => (filter ? filter(e) : true))
      .reduce((acc: Totals, expense) => {
        acc[expense.currency] =
          (acc[expense.currency] || 0) + expense.amount
        return acc
      }, {})
  }

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const thisMonthTotals = totalsByCurrency(e => {
    const d = new Date(e.expense_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  const reimbursedTotals = totalsByCurrency(
    e => e.status === 'Reimbursed'
  )

  return (
  <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">Expense Dashboard</h1>

      <Link
        href="/expenses"
        className="bg-black text-white px-4 py-2 rounded text-sm"
      >
        + Add Expense
      </Link>
    </div>

    {loading && <p>Loading…</p>}

    {!loading && (
      <div className="space-y-6">
        {/* Primary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="This Month"
            subtitle="Spending"
            totals={thisMonthTotals}
            highlight
          />

          <StatCard
            title="Pending"
            subtitle="Expenses"
            value={expenses.filter(e => e.status === 'Pending').length}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="Reimbursed"
            subtitle="Total"
            totals={reimbursedTotals}
          />

          <StatCard
            title="All Time"
            subtitle="Expenses"
            totals={totalsByCurrency()}
          />
        </div>
      </div>
    )}
  </div>
)

}

function StatCard({
  title,
  subtitle,
  totals,
  value,
  highlight = false,
}: {
  title: string
  subtitle?: string
  totals?: Totals
  value?: number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? 'bg-gray-50 border-gray-300' : 'bg-white'
      }`}
    >
      <div className="mb-2">
        <p className="text-sm text-gray-500">{title}</p>
        {subtitle && (
          <p className="text-xs text-gray-400">{subtitle}</p>
        )}
      </div>

      {totals &&
        Object.entries(totals).map(([currency, amount]) => (
          <p
            key={currency}
            className="text-xl font-semibold leading-tight"
          >
            {formatMoney(amount, currency)}
          </p>
        ))}

      {value !== undefined && (
        <p className="text-xl font-semibold">{value}</p>
      )}
    </div>
  )
}

