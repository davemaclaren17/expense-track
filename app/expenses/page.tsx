'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types/expense'
import { formatMoney } from '@/lib/currency'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

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

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Expenses</h1>

      {loading && <p>Loading…</p>}

      {!loading && expenses.length === 0 && (
        <p>No expenses yet.</p>
      )}

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
