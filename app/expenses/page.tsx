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
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Expenses</h1>

      {/* ADD EXPENSE FORM */}
      <form onSubmit={addExpense} className="mb-8 space-y-4 border p-4 rounded">
        <h2 className="font-medium">Add Expense</h2>

        <input
          className="w-full border p-2 rounded"
          placeholder="Title (e.g. Evening meal)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <input
          type="number"
          step="0.01"
          className="w-full border p-2 rounded"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <select
          className="w-full border p-2 rounded"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
        >
          <option value="GBP">GBP</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="CHF">CHF</option>
        </select>

        <input
          className="w-full border p-2 rounded"
          placeholder="Category (e.g. Meals)"
          value={category}
          onChange={e => setCategory(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          placeholder="Country"
          value={country}
          onChange={e => setCountry(e.target.value)}
        />

        <input
          type="date"
          className="w-full border p-2 rounded"
          value={expenseDate}
          onChange={e => setExpenseDate(e.target.value)}
        />

        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded"
        >
          Add Expense
        </button>
      </form>

<button
  onClick={() => exportToCSV(expenses)}
  className="mb-4 border px-3 py-1 rounded text-sm"
>
  Export CSV
</button>


      {/* EXPENSE LIST */}
      {loading && <p>Loading…</p>}

      {!loading && expenses.length === 0 && <p>No expenses yet.</p>}

      <ul className="space-y-3">
        {expenses.map(expense => (
          <li
            key={expense.id}
            className="border rounded p-4 flex justify-between items-center"
          >
            <div>
              <p className="font-medium">{expense.title}</p>
              <p className="text-sm text-gray-500">
                {expense.category} · {expense.country} · {expense.status}
              </p>
              <p className="text-sm text-gray-400">
                {expense.expense_date}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <p className="font-semibold">
                {formatMoney(expense.amount, expense.currency)}
              </p>
              <button
                onClick={() => deleteExpense(expense.id)}
                className="text-red-600 text-sm"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
