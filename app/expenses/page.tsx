'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types/expense'
import { formatMoney } from '@/lib/currency'

function exportToCSV(expenses: Expense[]) {
  const headers = [
    'Title',
    'Merchant',
    'Amount',
    'Currency',
    'Category',
    'Status',
    'Reimbursable',
    'Country',
    'Notes',
    'Date',
  ]

  const rows = expenses.map(e => [
    e.title,
    e.merchant ?? '',
    e.amount,
    e.currency,
    e.category,
    e.status,
    e.reimbursable ? 'Yes' : 'No',
    e.country,
    e.notes ?? '',
    e.expense_date,
  ])

  const csvContent =
    [headers, ...rows].map(r => r.join(',')).join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'expenses.csv'
  a.click()

  URL.revokeObjectURL(url)
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [category, setCategory] = useState('Meals')
  const [country, setCountry] = useState('United Kingdom')
  const [expenseDate, setExpenseDate] = useState('')

  useEffect(() => {
    fetchExpenses()
  }, [])

  async function fetchExpenses() {
    setLoading(true)

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })

    if (!error && data) {
      setExpenses(data)
    }

    setLoading(false)
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !amount || !expenseDate) return

    await supabase.from('expenses').insert({
      title,
      amount: Number(amount),
      currency,
      category,
      status: 'Pending',
      reimbursable: false,
      country,
      expense_date: expenseDate,
    })

    setTitle('')
    setAmount('')
    setExpenseDate('')
    fetchExpenses()
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Expenses</h1>

        <button
          onClick={() => exportToCSV(expenses)}
          className="border px-3 py-2 rounded text-sm"
        >
          Export CSV
        </button>
      </div>

      {/* Add Expense */}
      <form
        onSubmit={addExpense}
        className="space-y-4 border rounded-xl p-4 bg-white"
      >
        <h2 className="font-medium">Add Expense</h2>

        <input
          className="w-full border p-3 rounded"
          placeholder="Title (e.g. Evening meal)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <input
          type="number"
          step="0.01"
          className="w-full border p-3 rounded"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            className="border p-3 rounded"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
          >
            <option>GBP</option>
            <option>EUR</option>
            <option>USD</option>
            <option>CHF</option>
          </select>

          <input
            className="border p-3 rounded"
            placeholder="Category"
            value={category}
            onChange={e => setCategory(e.target.value)}
          />
        </div>

        <input
          className="w-full border p-3 rounded"
          placeholder="Country"
          value={country}
          onChange={e => setCountry(e.target.value)}
        />

        <input
          type="date"
          className="w-full border p-3 rounded"
          value={expenseDate}
          onChange={e => setExpenseDate(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-black text-white py-3 rounded"
        >
          Add Expense
        </button>
      </form>

      {/* Expense List */}
      {loading && <p>Loading…</p>}
      {!loading && expenses.length === 0 && <p>No expenses yet.</p>}

      <div className="space-y-3">
        {expenses.map(expense => (
          <div
            key={expense.id}
            className="border rounded-xl p-4 bg-white"
          >
            <div className="flex justify-between items-start mb-1">
              <p className="font-medium">
                {formatMoney(expense.amount, expense.currency)}
              </p>
              <span className="text-xs text-gray-400">
                {expense.expense_date}
              </span>
            </div>

            <p className="text-sm text-gray-700">
              {expense.title}
            </p>

            <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
              <span>
                {expense.category} · {expense.country}
              </span>

              <button
                onClick={() => deleteExpense(expense.id)}
                className="text-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
