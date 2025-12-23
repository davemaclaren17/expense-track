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

const CATEGORY_OPTIONS = [
  'Mileage',
  'Hotel',
  'Food & Drinks',
] as const

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
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // form fields
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

  const canSave = useMemo(() => {
    return description.trim() && amount.trim() && expenseDate.trim()
  }, [description, amount, expenseDate])

  useEffect(() => {
    fetchExpenses()
  }, [])

  async function fetchExpenses() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })

    if (data) setExpenses(data as ExpenseRow[])
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
    if (!canSave || saving) return

    setSaving(true)

    const { data: inserted, error } = await supabase
      .from('expenses')
      .insert({
        business_trip: businessTrip || null,
        title: description,
        merchant: vendor || null,
        notes: notes || null,
        amount: Number(amount),
        currency,
        category,
        status: 'Pending',
        country,
        expense_date: expenseDate,
        receipt_path: null,
      })
      .select('*')
      .single()

    if (error || !inserted) {
      showToast('error', 'Failed to save expense')
      setSaving(false)
      return
    }

    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop() || 'jpg'
      const path = `${inserted.id}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, receiptFile, { upsert: true })

      if (!uploadError) {
        await supabase.from('expenses').update({ receipt_path: path }).eq('id', inserted.id)
        showToast('success', 'Expense and receipt saved ✅')
      } else {
        showToast('error', uploadError.message)
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
    if (expense.receipt_path) {
      await supabase.storage.from('receipts').remove([expense.receipt_path])
    }

    await supabase.from('expenses').delete().eq('id', expense.id)
    showToast('success', 'Expense deleted')
    fetchExpenses()
  }

  async function exportZIP() {
    const zip = new JSZip()
    zip.file('expenses.csv', toCSV(expenses))

    const folder = zip.folder('receipts')
    for (const e of expenses) {
      if (!e.receipt_path) continue
      const { data } = await supabase.storage.from('receipts').download(e.receipt_path)
      if (data) folder?.file(e.receipt_path, data)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'expenses_export.zip')
    showToast('success', 'Export downloaded')
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <div className="flex gap-2">
          <button onClick={exportZIP} className="border px-3 py-2 rounded text-sm">
            Export
          </button>
          <button onClick={() => setOpen(true)} className="bg-black text-white px-3 py-2 rounded text-sm">
            + Add Expense
          </button>
        </div>
      </div>

      {loading && <p>Loading…</p>}

      <div className="space-y-3">
        {expenses.map(e => (
          <div key={e.id} className="border rounded-xl p-4 bg-white">
            <div className="flex justify-between mb-1">
              <p className="font-medium">{formatMoney(e.amount, e.currency)}</p>
              <span className="text-xs text-gray-400">{e.expense_date}</span>
            </div>
            <p className="text-sm">{e.title}</p>
            <div className="mt-2 flex justify-between text-xs text-gray-400">
              <span>{e.category}</span>
              <button onClick={() => deleteExpense(e)} className="text-red-600">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-0 flex justify-center items-start p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow border max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center px-5 py-4 border-b">
                <h2 className="text-lg font-semibold">Add New Expense</h2>
                <button onClick={() => setOpen(false)} className="text-xl">×</button>
              </div>

              <div className="overflow-y-auto p-5">
                <form onSubmit={addExpense} className="space-y-4">
                  <input type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />

                  <input className="w-full border p-3 rounded-xl" placeholder="Business Trip"
                    value={businessTrip} onChange={e => setBusinessTrip(e.target.value)} />

                  <input className="w-full border p-3 rounded-xl" placeholder="Description *"
                    value={description} onChange={e => setDescription(e.target.value)} required />

                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" className="border p-3 rounded-xl" placeholder="Amount"
                      value={amount} onChange={e => setAmount(e.target.value)} required />
                    <select className="border p-3 rounded-xl" value={currency} onChange={e => setCurrency(e.target.value)}>
                      <option>GBP</option><option>EUR</option><option>USD</option><option>CHF</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <select className="border p-3 rounded-xl" value={category} onChange={e => setCategory(e.target.value as any)}>
                      {CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input type="date" className="border p-3 rounded-xl"
                      value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required />
                  </div>

                  <input className="w-full border p-3 rounded-xl" placeholder="Vendor / Merchant"
                    value={vendor} onChange={e => setVendor(e.target.value)} />

                  <input className="w-full border p-3 rounded-xl" placeholder="Notes"
                    value={notes} onChange={e => setNotes(e.target.value)} />

                  <button type="submit" disabled={!canSave || saving}
                    className="w-full bg-black text-white py-3 rounded-xl">
                    {saving ? 'Saving…' : 'Add Expense'}
                  </button>

                  <div className="h-6" />
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
