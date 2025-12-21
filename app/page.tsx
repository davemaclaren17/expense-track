'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types/expense'
import { formatMoney } from '@/lib/currency'

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
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      {loading && <p>Loading…</p>}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard title="This Month" totals={thisMonthTotals} />
          <StatCard title="Reimbursed" totals={reimbursedTotals} />
          <StatCard
            title="Total Expenses"
            totals={totalsByCurrency()}
          />
          <StatCard
            title="Pending Count"
            value={expenses.filter(e => e.status === 'Pending').length}
          />
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  totals,
  value,
}: {
  title: string
  totals?: Totals
  value?: number
}) {
  return (
    <div className="border rounded p-4">
      <h2 className="text-sm text-gray-500 mb-2">{title}</h2>

      {totals &&
        Object.entries(totals).map(([currency, amount]) => (
          <p key={currency} className="text-lg font-semibold">
            {formatMoney(amount, currency)}
          </p>
        ))}

      {value !== undefined && (
        <p className="text-lg font-semibold">{value}</p>
      )}
    </div>
  )
}
