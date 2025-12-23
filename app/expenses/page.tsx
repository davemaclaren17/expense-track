'use client'

import { useEffect, useState } from 'react'
import JSZip from 'jszip'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types/expense'
import { formatMoney } from '@/lib/currency'
import { useToast } from '@/components/ToastProvider'


type ExpenseWithReceipt = Expense & { receipt_path: string | null }

function toCSV(expenses: ExpenseWithReceipt[]) {
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
    'ReceiptPath',
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
    e.receipt_path ?? '',
  ])

  return [headers, ...rows].map(r => r.join(',')).join('\n')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExpensesPage() {
  const { showToast } = useToast()

  const [expenses, setExpenses] = useState<ExpenseWithReceipt[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [category, setCategory] = useState('Meals')
  const [country, setCountry] = useState('United Kingdom')
  const [expenseDate, setExpenseDate] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  useEffect(() => {
    fetchExpenses()
  }, [])

  async function fetchExpenses() {
    setLoading(true)

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })

    if (!error && data) setExpenses(data as ExpenseWithReceipt[])
    setLoading(false)
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !amount || !expenseDate) return

    // 1) Insert expense first (so we get an id)
    const { data: inserted, error: insertError } = await supabase
      .from('expenses')
      .insert({
        title,
        amount: Number(amount),
        currency,
        category,
        status: 'Pending',
        reimbursable: false,
        country,
        expense_date: expenseDate,
        receipt_path: null,
      })
      .select('*')
      .single()

    if (insertError || !inserted) {
      alert('Could not save expense. Please try again.')
      return
    }

    // 2) Upload receipt (optional)
    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${inserted.id}.${safeExt}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, receiptFile, {
          upsert: true,
          contentType: receiptFile.type || 'image/jpeg',
        })

      if (!uploadError) {
        // 3) Store receipt path on the expense row
        await supabase.from('expenses').update({ receipt_path: path }).eq('id', inserted.id)
      } else {
        alert(`Receipt upload failed: ${uploadError.message}`)
        }

    }

    setTitle('')
    setAmount('')
    setExpenseDate('')
    setReceiptFile(null)

    fetchExpenses()
  }

  async function deleteExpense(expense: ExpenseWithReceipt) {
    // delete receipt first (if any)
    if (expense.receipt_path) {
      await supabase.storage.from('receipts').remove([expense.receipt_path])
    }
    await supabase.from('expenses').delete().eq('id', expense.id)
    fetchExpenses()
  }

  async function exportZIP() {
    const zip = new JSZip()

    // CSV
    const csv = toCSV(expenses)
    zip.file('expenses.csv', csv)

    // Receipts folder
    const receiptsFolder = zip.folder('receipts')

    // Download receipts into the zip (only those that exist)
    for (const exp of expenses) {
      if (!exp.receipt_path) continue
      const { data, error } = await supabase.storage.from('receipts').download(exp.receipt_path)
      if (!error && data) {
        receiptsFolder?.file(exp.receipt_path, data)
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'expenses_export.zip')
  }

  async function openReceipt(receiptPath: string) {
    // For public bucket: create public URL
    const { data } = supabase.storage.from('receipts').getPublicUrl(receiptPath)
    if (data?.publicUrl) window.open(data.publicUrl, '_blank')
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Expenses</h1>

        <button
          onClick={exportZIP}
          className="border px-3 py-2 rounded text-sm"
        >
          Export (CSV + Receipts)
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

        {/* Receipt upload */}
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Receipt image (optional)</label>
          <input
            type="file"
            accept="image/*"
            className="w-full border p-3 rounded"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          />
          {receiptFile && (
            <p className="text-xs text-gray-500">Selected: {receiptFile.name}</p>
          )}
        </div>

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

            <p className="text-sm text-gray-700">{expense.title}</p>

            <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
              <span>{expense.category} · {expense.country}</span>

              <div className="flex items-center gap-3">
                {expense.receipt_path && (
                  <button
                    onClick={() => openReceipt(expense.receipt_path!)}
                    className="text-blue-600"
                    type="button"
                  >
                    Receipt
                  </button>
                )}
                <button
                  onClick={() => deleteExpense(expense)}
                  className="text-red-600"
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
