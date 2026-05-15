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

type InsightItem = {
  label: string
  value: number
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
})

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

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return MONTH_FORMATTER.format(new Date(year, month - 1, 1))
}

function getPreviousMonthKey() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return monthKey(d)
}

function getCurrentMonthKey() {
  return monthKey(new Date())
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function topItems(items: ExpenseRow[], getLabel: (expense: ExpenseRow) => string, limit = 4): InsightItem[] {
  const totals = new Map<string, number>()

  for (const expense of items) {
    const label = getLabel(expense).trim() || 'Unassigned'
    totals.set(label, (totals.get(label) ?? 0) + Number(expense.amount || 0))
  }

  return Array.from(totals, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
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

  const currentMonthKey = getCurrentMonthKey()
  const previousMonthKey = getPreviousMonthKey()

  const monthlyTotals = useMemo(() => {
    const totals = new Map<string, number>()

    for (const expense of expenses) {
      const key = expense.expense_date.slice(0, 7)
      totals.set(key, (totals.get(key) ?? 0) + Number(expense.amount || 0))
    }

    return totals
  }, [expenses])

  const previousMonthTotal = monthlyTotals.get(previousMonthKey) ?? 0
  const monthlyChange = percentChange(monthTotal, previousMonthTotal)

  const categoryTotals = useMemo(() => {
    return topItems(expenses, expense => expense.category)
  }, [expenses])

  const merchantTotals = useMemo(() => {
    return topItems(expenses, expense => expense.merchant ?? 'No merchant')
  }, [expenses])

  const trendTotals = useMemo(() => {
    const months: InsightItem[] = []
    const cursor = new Date()
    cursor.setDate(1)

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(cursor)
      d.setMonth(cursor.getMonth() - i)
      const key = monthKey(d)
      months.push({
        label: monthLabel(key),
        value: monthlyTotals.get(key) ?? 0,
      })
    }

    return months
  }, [monthlyTotals])

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

      {/* Insights */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightPanel
          title="Spending by category"
          subtitle="Top areas by total value"
          items={categoryTotals}
          emptyText="Add expenses to see category insights."
          accent="coral"
        />

        <MonthComparison
          currentLabel={monthLabel(currentMonthKey)}
          previousLabel={monthLabel(previousMonthKey)}
          currentTotal={monthTotal}
          previousTotal={previousMonthTotal}
          change={monthlyChange}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendPanel items={trendTotals} />

        <InsightPanel
          title="Top merchants"
          subtitle="Where spending is concentrated"
          items={merchantTotals}
          emptyText="Merchant insights will appear after expenses are added."
          accent="navy"
        />
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

function InsightPanel({
  title,
  subtitle,
  items,
  emptyText,
  accent,
}: {
  title: string
  subtitle: string
  items: InsightItem[]
  emptyText: string
  accent: 'coral' | 'navy'
}) {
  const max = Math.max(...items.map(item => item.value), 0)
  const barClass = accent === 'coral' ? 'bg-[#f97363]' : 'bg-[#172554]'

  return (
    <div className="app-card min-w-0 overflow-hidden p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#172554]">{title}</h2>
        <p className="text-sm text-[#667085]">{subtitle}</p>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-[#667085]">{emptyText}</p>
      )}

      {items.length > 0 && (
        <div className="min-w-0 space-y-4">
          {items.map(item => {
            const width = max > 0 ? Math.max((item.value / max) * 100, 6) : 0

            return (
              <div key={item.label} className="min-w-0 space-y-2">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#172554]">{item.label}</p>
                  <p className="shrink-0 text-sm font-semibold text-[#172554]">
                    {formatMoney(item.value, 'GBP')}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-[#edf1f7]">
                  <div
                    className={`h-2 rounded-full ${barClass}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MonthComparison({
  currentLabel,
  previousLabel,
  currentTotal,
  previousTotal,
  change,
}: {
  currentLabel: string
  previousLabel: string
  currentTotal: number
  previousTotal: number
  change: number
}) {
  const increased = change > 0
  const flat = change === 0
  const label = flat ? 'No change' : `${Math.abs(change).toFixed(0)}% ${increased ? 'higher' : 'lower'}`

  return (
    <div className="app-card min-w-0 overflow-hidden">
      <div className="bg-[#172554] p-4 text-white">
        <h2 className="text-lg font-semibold">Month comparison</h2>
        <p className="text-sm text-white/70">{currentLabel} vs {previousLabel}</p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-[#dbe3ef]">
        <div className="p-4">
          <p className="text-sm text-[#667085]">{currentLabel}</p>
          <p className="text-xl font-semibold text-[#172554]">{formatMoney(currentTotal, 'GBP')}</p>
        </div>
        <div className="p-4">
          <p className="text-sm text-[#667085]">{previousLabel}</p>
          <p className="text-xl font-semibold text-[#172554]">{formatMoney(previousTotal, 'GBP')}</p>
        </div>
      </div>

      <div className="border-t border-[#edf1f7] p-4">
        <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${
          increased ? 'border-red-200 bg-red-50 text-red-700' : 'border-teal-200 bg-teal-50 text-teal-700'
        }`}>
          {label} than last month
        </span>
      </div>
    </div>
  )
}

function TrendPanel({ items }: { items: InsightItem[] }) {
  const max = Math.max(...items.map(item => item.value), 0)

  return (
    <div className="app-card min-w-0 overflow-hidden p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#172554]">Six-month trend</h2>
        <p className="text-sm text-[#667085]">Monthly spending pattern</p>
      </div>

      <div className="flex h-44 min-w-0 items-end gap-1.5 sm:gap-3">
        {items.map(item => {
          const height = max > 0 ? Math.max((item.value / max) * 100, 8) : 8

          return (
            <div key={item.label} className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-2">
              <div className="flex h-28 w-full min-w-0 items-end rounded-md bg-[#edf1f7]">
                <div
                  className="w-full rounded-md bg-[#f97363]"
                  style={{ height: `${height}%` }}
                  title={`${item.label}: ${formatMoney(item.value, 'GBP')}`}
                />
              </div>
              <p className="w-full break-words text-center text-[10px] font-medium leading-tight text-[#667085] sm:text-[11px]">{item.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
