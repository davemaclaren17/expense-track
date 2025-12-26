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

  // Sheet open + mode
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null) // null = new
  const isEditing = editingId !== null

  // saving
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

  // track existing receipt for edit mode (so we can remove it)
  const [existingReceiptPath, setExistingReceiptPath] = useState<string | null>(null)

  const canSave = useMemo(() => {
    return description.trim().length > 0 && amount.trim().length > 0 && expenseDate.trim().length > 0
  }, [description, amount, expenseDate])

  useEffect(() => {
    fetchExpenses()
  }, [])

  // Lock background scroll on iOS when sheet open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
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
    setExistingReceiptPath(null)
    setEditingId(null)
  }

  function openNew() {
    resetForm()
    setOpen(true)
  }

  function openEdit(exp: ExpenseRow) {
    setEditingId(exp.id)
    setBusinessTrip(exp.business_trip ?? '')
    setDescription(exp.title ?? '')
    setVendor(exp.merchant ?? '')
    setNotes(exp.notes ?? '')
    setAmount(String(exp.amount ?? ''))
    setCurrency(exp.currency ?? 'GBP')
    setCategory((exp.category as any) ?? 'Food & Drinks')
    setCountry(exp.country ?? 'United Kingdom')
    setExpenseDate(exp.expense_date ?? '')
    setReceiptFile(null)
    setExistingReceiptPath(exp.receipt_path ?? null)
    setOpen(true)
  }

  function closeSheet() {
    setOpen(false)
    resetForm()
  }

  async function upsertReceipt(expenseId: string) {
    if (!receiptFile) return null

    const extRaw = receiptFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const ext = extRaw.replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${expenseId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(path, receiptFile, {
        upsert: true,
        contentType: receiptFile.type || 'image/jpeg',
      })

    if (uploadError) {
      showToast('error', `Receipt upload failed: ${uploadError.message}`)
      return null
    }

    return path
  }

  async function removeReceipt() {
    if (!isEditing || !editingId || !existingReceiptPath) return

    setSaving(true)
    try {
      // 1) remove file
      const { error: removeError } = await supabase.storage
        .from('receipts')
        .remove([existingReceiptPath])

      if (removeError) {
        showToast('error', `Could not remove receipt: ${removeError.message}`)
        return
      }

      // 2) clear column in DB
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ receipt_path: null })
        .eq('id', editingId)

      if (updateError) {
        showToast('error', `Could not update expense: ${updateError.message}`)
        return
      }

      setExistingReceiptPath(null)
      showToast('success', 'Receipt removed ✅')
      fetchExpenses()
    } finally {
      setSaving(false)
    }
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave || saving) {
      showToast('error', 'Please fill in Description, Amount and Date.')
      return
    }

    setSaving(true)

    try {
      if (!isEditing) {
        // INSERT new
        const { data: inserted, error: insertError } = await supabase
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

        // optional receipt
        const receiptPath = await upsertReceipt(inserted.id)
        if (receiptPath) {
          await supabase.from('expenses').update({ receipt_path: receiptPath }).eq('id', inserted.id)
          showToast('success', 'Expense and receipt saved ✅')
        } else {
          showToast('success', 'Expense saved ✅')
        }
      } else {
        // UPDATE existing
        const id = editingId!

        const { error: updateError } = await supabase
          .from('expenses')
          .update({
            business_trip: businessTrip || null,
            title: description,
            merchant: vendor || null,
            notes: notes || null,
            amount: Number(amount),
            currency,
            category,
            country,
            expense_date: expenseDate,
          })
          .eq('id', id)

        if (updateError) {
          showToast('error', `Update failed: ${updateError.message}`)
          setSaving(false)
          return
        }

        // optional receipt replacement
        const receiptPath = await upsertReceipt(id)
        if (receiptPath) {
          await supabase.from('expenses').update({ receipt_path: receiptPath }).eq('id', id)
          setExistingReceiptPath(receiptPath)
          showToast('success', 'Expense updated + receipt replaced ✅')
        } else {
          showToast('success', 'Expense updated ✅')
        }
      }

      closeSheet()
      fetchExpenses()
    } finally {
      setSaving(false)
    }
  }

  async function deleteExpense(expense: ExpenseRow) {
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
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-gray-500">Track spending with receipts</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportZIP}
            className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm active:scale-[0.99]"
            type="button"
          >
            Export
          </button>
          <button
            onClick={openNew}
            className="rounded-xl bg-black text-white px-3 py-2 text-sm shadow-sm active:scale-[0.99]"
            type="button"
          >
            + Add
          </button>
        </div>
      </div>

      {/* List container */}
      <div className="rounded-2xl bg-gray-50 border p-3">
        {loading && <p className="p-3 text-sm text-gray-600">Loading…</p>}
        {!loading && expenses.length === 0 && <p className="p-3 text-sm text-gray-600">No expenses yet.</p>}

        <div className="space-y-2">
          {expenses.map(exp => (
            <div key={exp.id} className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">{exp.category}</p>
                  <p className="font-medium text-gray-900 truncate">{exp.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {exp.merchant ? `${exp.merchant} · ` : ''}
                    {exp.expense_date}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold">{formatMoney(exp.amount, exp.currency)}</p>
                  <p className="text-xs text-gray-500">{exp.country}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="flex gap-3">
                  <button onClick={() => openEdit(exp)} className="text-blue-600 active:opacity-70" type="button">
                    Edit
                  </button>

                  {exp.receipt_path && (
                    <button
                      onClick={() => openReceipt(exp.receipt_path!)}
                      className="text-blue-600 active:opacity-70"
                      type="button"
                    >
                      Receipt
                    </button>
                  )}
                </div>

                <button onClick={() => deleteExpense(exp)} className="text-red-600 active:opacity-70" type="button">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeSheet} />

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-lg">
              <div className="rounded-t-3xl bg-white border shadow-2xl max-h-[88vh] flex flex-col">
                <div className="pt-3 flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-gray-300" />
                </div>

                <div className="px-5 pt-3 pb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{isEditing ? 'Edit Expense' : 'Add New Expense'}</h2>
                  <button onClick={closeSheet} className="text-xl text-gray-500" type="button" aria-label="Close">
                    ×
                  </button>
                </div>

                <div className="overflow-y-auto overscroll-contain px-5 pb-5">
                  <form id="expense-form" onSubmit={saveExpense} className="space-y-4">
                    {/* Receipt */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Receipt Image</label>

                      <label className="block cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                        />

                        <div className="border-2 border-dashed rounded-2xl p-6 text-center text-gray-500 bg-gray-50">
                          <div className="text-2xl mb-2">🧾</div>
                          <div className="font-medium">Tap to upload receipt</div>
                          <div className="text-xs text-gray-400">PNG, JPG up to 10MB</div>

                          {receiptFile && (
                            <div className="mt-2 text-xs text-gray-700">
                              Selected: {receiptFile.name}
                            </div>
                          )}

                          {isEditing && !receiptFile && (
                            <div className="mt-2 text-xs text-gray-500">
                              (Optional) Upload to replace the existing receipt
                            </div>
                          )}
                        </div>
                      </label>

                      {/* ✅ Remove receipt button */}
                      {isEditing && existingReceiptPath && (
                        <button
                          type="button"
                          onClick={removeReceipt}
                          disabled={saving}
                          className="w-full rounded-2xl border border-red-200 bg-red-50 text-red-700 py-3 text-[16px] font-medium disabled:opacity-50 active:scale-[0.99]"
                        >
                          Remove receipt
                        </button>
                      )}
                    </div>

                    {/* Form fields */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Business Trip</label>
                      <input
                        className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
                        placeholder="e.g., London Conference, Client Visit"
                        value={businessTrip}
                        onChange={e => setBusinessTrip(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Description *</label>
                      <input
                        className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
                        placeholder="What was this expense for?"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Amount *</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
                          placeholder="0.00"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Currency</label>
                        <select
                          className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
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
                        <label className="text-sm font-medium text-gray-700">Category *</label>
                        <select
                          className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
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
                        <label className="text-sm font-medium text-gray-700">Date *</label>
                        <input
                          type="date"
                          className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
                          value={expenseDate}
                          onChange={e => setExpenseDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Vendor / Merchant</label>
                      <input
                        className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
                        placeholder="e.g., Amazon, Uber, Starbucks"
                        value={vendor}
                        onChange={e => setVendor(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Notes</label>
                      <input
                        className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
                        placeholder="Any extra details…"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Country</label>
                      <input
                        className="w-full rounded-2xl border bg-white px-4 py-3 text-[16px]"
                        placeholder="Country"
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                      />
                    </div>

                    <div className="h-24" />
                  </form>
                </div>

                <div className="border-t bg-white p-4">
                  <button
                    form="expense-form"
                    type="submit"
                    disabled={!canSave || saving}
                    className="w-full rounded-2xl bg-black text-white py-3 text-[16px] font-medium disabled:opacity-50 active:scale-[0.99]"
                  >
                    {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Expense'}
                  </button>

                  <div className="h-[env(safe-area-inset-bottom)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
