'use client'

import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types/expense'
import { formatMoney } from '@/lib/currency'
import { useToast } from '@/components/ToastProvider'

type ExpenseRow = Expense & {
  receipt_path: string | null
  business_trip: string | null
}

const CATEGORY_OPTIONS = ['Mileage', 'Hotel', 'Food & Drinks'] as const

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function toCSV(expenses: ExpenseRow[]) {
  const headers = [
    'BusinessTrip',
    'Description',
    'VendorMerchant',
    'Notes',
    'Amount',
    'Currency',
    'Category',
    'Status',
    'Country',
    'Date',
    'ReceiptPath',
  ]

  const rows = expenses.map(e => [
    e.business_trip ?? '',
    e.title ?? '',
    e.merchant ?? '',
    e.notes ?? '',
    e.amount,
    e.currency,
    e.category,
    e.status,
    e.country,
    e.expense_date,
    e.receipt_path ?? '',
  ])

  return [headers, ...rows].map(r => r.join(',')).join('\n')
}

export default function ExpensesPage() {
  const { showToast } = useToast()

  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)

  // modal
  const [open, setOpen] = useState(false)

  // form
  const [businessTrip, setBusinessTrip] = useState('')
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('Food & Drinks')
  const [country, setCountry] = useState('United Kingdom')
  const [expenseDate, setExpenseDate] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const canSave = useMemo(() => {
    return description.trim().length > 0 && amount.trim().length > 0 && expenseDate.trim().length > 0
  }, [description, amount, expenseDate])

  useEffect(() => {
    fetchExpenses()
  }, [])

  // Prevent background scroll on iPhone when modal open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  async function fetchExpenses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })

    if (!error && data) setExpenses(data as ExpenseRow[])
    setLoading(false)
  }

  function resetForm() {
    setBusinessTrip('')
    setDescription('')
    setVendor('')
    setNotes('')
    setAmount('')
    setCurrency('GBP')
    setCategory('Food & Drinks')
    setCountry('United Kingdom')
    setExpenseDate('')
    setReceiptFile(null)
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave || saving) {
      showToast('error', 'Please fill in Description, Amount and Date.')
      return
    }

    setSaving(true)

    // 1) Insert expense first (so we get an id for receipt filename)
    const { data: inserted, error: insertError } = await supabase
      .from('expenses')
      .insert({
        business_trip: businessTrip || null,
        title: description, // Description maps to title
        merchant: vendor || null,
        notes: notes || null,
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
      showToast('error', `Could not save expense: ${insertError?.message ?? 'Unknown error'}`)
      setSaving(false)
      return
    }

    // 2) Upload receipt (optional)
    if (receiptFile) {
      const extRaw = receiptFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const ext = extRaw.replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${inserted.id}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, receiptFile, {
          upsert: true,
          contentType: receiptFile.type || 'image/jpeg',
        })

      if (!uploadError) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update({ receipt_path: path })
          .eq('id', inserted.id)

        if (updateError) {
          showToast('error', `Receipt uploaded but failed to link: ${updateError.message}`)
        } else {
          showToast('success', 'Expense and receipt saved ✅')
        }
      } else {
        showToast('error', `Receipt upload failed: ${uploadError.message}`)
      }
    } else {
      showToast('success', 'Expense saved ✅')
    }

    setSaving(false)
    setOpen(false)
    resetForm()
    fetchExpenses()
  }

  async function deleteExpense(expense: ExpenseRow) {
    try {
      if (expense.receipt_path) {
        await supabase.storage.from('receipts').remove([expense.receipt_path])
      }
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
      if (error) {
        showToast('error', `Delete failed: ${error.message}`)
        return
      }
      showToast('success', 'Expense deleted ✅')
      fetchExpenses()
    } catch {
      showToast('error', 'Delete failed. Please try again.')
    }
  }

  async function openReceipt(receiptPath: string) {
    const { data } = supabase.storage.from('receipts').getPublicUrl(receiptPath)
    if (data?.publicUrl) window.open(data.publicUrl, '_blank')
  }

  async function exportZIP() {
    try {
      const zip = new JSZip()
      zip.file('expenses.csv', toCSV(expenses))

      const receiptsFolder = zip.folder('receipts')

      for (const exp of expenses) {
        if (!exp.receipt_path) continue
        const { data, error } = await supabase.storage.from('receipts').download(exp.receipt_path)
        if (!error && data) receiptsFolder?.file(exp.receipt_path, data)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, 'expenses_export.zip')
      showToast('success', 'Export downloaded ✅')
    } catch {
      showToast('error', 'Export failed. Please try again.')
    }
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Expenses</h1>

        <div className="flex gap-2">
          <button onClick={exportZIP} className="border px-3 py-2 rounded text-sm" type="button">
            Export
          </button>
          <button
            onClick={() => setOpen(true)}
            className="bg-black text-white px-3 py-2 rounded text-sm"
            type="button"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {/* List */}
      {loading && <p>Loading…</p>}
      {!loading && expenses.length === 0 && <p>No expenses yet.</p>}

      <div className="space-y-3">
        {expenses.map(expense => (
          <div key={expense.id} className="border rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start mb-1">
              <p className="font-medium">{formatMoney(expense.amount, expense.currency)}</p>
              <span className="text-xs text-gray-400">{expense.expense_date}</span>
            </div>

            <p className="text-sm text-gray-800">{expense.title}</p>

            <div className="mt-2 flex justify-between items-center text-xs text-gray-400">
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

                <button onClick={() => deleteExpense(expense)} className="text-red-600" type="button">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setOpen(false)
              resetForm()
            }}
          />

          {/* modal container */}
          <div className="absolute inset-0 flex items-start justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow border overflow-hidden max-h-[90vh] flex flex-col">
              {/* fixed header */}
              <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                <h2 className="text-lg font-semibold">Add New Expense</h2>
                <button
                  onClick={() => {
                    setOpen(false)
                    resetForm()
                  }}
                  className="text-xl leading-none text-gray-500"
                  type="button"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* scrollable body */}
              <div className="overflow-y-auto overscroll-contain p-5">
                <form id="add-expense-form" onSubmit={addExpense} className="space-y-4">
                  {/* Receipt upload */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Receipt Image</label>

                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                      />

                      <div className="border-2 border-dashed rounded-xl p-6 text-center text-gray-500">
                        <div className="text-2xl mb-2">🧾</div>
                        <div className="font-medium">Click to upload receipt</div>
                        <div className="text-xs text-gray-400">PNG, JPG up to 10MB</div>

                        {receiptFile && (
                          <div className="mt-2 text-xs text-gray-600">
                            Selected: {receiptFile.name}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Business Trip</label>
                    <input
                      className="w-full border p-3 rounded-xl"
                      placeholder="e.g., London Conference, Client Visit"
                      value={businessTrip}
                      onChange={e => setBusinessTrip(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description *</label>
                    <input
                      className="w-full border p-3 rounded-xl"
                      placeholder="What was this expense for?"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full border p-3 rounded-xl"
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Currency</label>
                      <select
                        className="w-full border p-3 rounded-xl"
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                      >
                        <option>GBP</option>
                        <option>EUR</option>
                        <option>USD</option>
                        <option>CHF</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category *</label>
                      <select
                        className="w-full border p-3 rounded-xl"
                        value={category}
                        onChange={e => setCategory(e.target.value as any)}
                      >
                        {CATEGORY_OPTIONS.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date *</label>
                      <input
                        type="date"
                        className="w-full border p-3 rounded-xl"
                        value={expenseDate}
                        onChange={e => setExpenseDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Vendor / Merchant</label>
                    <input
                      className="w-full border p-3 rounded-xl"
                      placeholder="e.g., Amazon, Uber, Starbucks"
                      value={vendor}
                      onChange={e => setVendor(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes</label>
                    <input
                      className="w-full border p-3 rounded-xl"
                      placeholder="Any extra details…"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <input
                      className="w-full border p-3 rounded-xl"
                      placeholder="Country"
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                    />
                  </div>
                </form>

                {/* bottom padding so fields don't hide behind sticky footer */}
                <div className="h-24" />
              </div>

              {/* sticky footer submit */}
              <div className="border-t p-4 shrink-0 bg-white">
                <button
                  form="add-expense-form"
                  type="submit"
                  disabled={!canSave || saving}
                  className="w-full bg-black text-white py-3 rounded-xl disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Add Expense'}
                </button>

                {/* iPhone safe area padding */}
                <div className="h-[env(safe-area-inset-bottom)]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
