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
    supabase
      .from('expenses')
      .select('*')
      .then(({ data }) => {
        if (data) {
          setExpenses(data)
        }

        setLoading(false)
      })
  }, [])

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
  <div className="app-page space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
      <h1 className="section-title">Expense Dashboard</h1>

      <Link
        href="/expenses"
        className="btn-accent"
      >
        + Add Expense
      </Link>
    </div>

    {loading && <p className="text-sm text-[#667085]">Loading…</p>}

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
      className={`app-card p-4 ${
        highlight ? 'bg-[#fff7f5]' : 'bg-white'
      }`}
    >
      <div className="mb-2">
        <p className="text-sm text-[#667085]">{title}</p>
        {subtitle && (
          <p className="text-xs text-[#98a2b3]">{subtitle}</p>
        )}
      </div>

      {totals &&
        Object.entries(totals).map(([currency, amount]) => (
          <p
            key={currency}
            className="text-xl font-semibold leading-tight text-[#172554]"
          >
            {formatMoney(amount, currency)}
          </p>
        ))}

      {value !== undefined && (
        <p className="text-xl font-semibold text-[#172554]">{value}</p>
      )}
    </div>
  )
}
