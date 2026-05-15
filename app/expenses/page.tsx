'use client'

import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Expense } from '@/types/expense'
import { formatMoney } from '@/lib/currency'
import { useToast } from '@/components/ToastProvider'



type ReceiptStatus = 'Pending' | 'Approved' | 'Rejected' | 'Reimbursed'
type FilterValue = 'All' | ReceiptStatus
type ExportStatus = 'All' | 'Pending' | 'Reimbursed'

type ExpenseRow = Expense & {
  receipt_path: string | null
  business_trip: string | null
  receipt_status: ReceiptStatus
}

const CATEGORY_OPTIONS = ['Mileage', 'Hotel', 'Food & Drinks','Taxi fare','Railfare','Metro','Flights','Hire Car','Fuel Receipts'] as const
const RECEIPT_STATUS_OPTIONS: ReceiptStatus[] = ['Pending', 'Approved', 'Rejected', 'Reimbursed']
const FILTER_OPTIONS: FilterValue[] = ['All', ...RECEIPT_STATUS_OPTIONS]
const EXPORT_STATUS_OPTIONS: ExportStatus[] = ['All', 'Pending', 'Reimbursed']
const supabase = createSupabaseBrowserClient()

function isCategoryOption(value: string): value is (typeof CATEGORY_OPTIONS)[number] {
  return CATEGORY_OPTIONS.includes(value as (typeof CATEGORY_OPTIONS)[number])
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvValue(value: string | number | null) {
  const text = String(value ?? '')

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
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
    'ReceiptStatus',
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
    e.receipt_status,
    e.country,
    e.expense_date,
    e.receipt_path ?? '',
  ])

  return [headers, ...rows].map(r => r.map(csvValue).join(',')).join('\n')
}

function matchesExportFilters(
  expense: ExpenseRow,
  startDate: string,
  endDate: string,
  status: ExportStatus
) {
  const afterStart = !startDate || expense.expense_date >= startDate
  const beforeEnd = !endDate || expense.expense_date <= endDate
  const statusMatches = status === 'All' || expense.receipt_status === status

  return afterStart && beforeEnd && statusMatches
}

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

export default function ExpensesPage() {
  const { showToast } = useToast()

  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)

  // NEW: filter state
  const [filter, setFilter] = useState<FilterValue>('All')
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [exportStatus, setExportStatus] = useState<ExportStatus>('All')

  // Sheet open + mode
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const isEditing = editingId !== null

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

  const [receiptStatus, setReceiptStatus] = useState<ReceiptStatus>('Pending')
  const [existingReceiptPath, setExistingReceiptPath] = useState<string | null>(null)

  const canSave = useMemo(() => {
    return description.trim().length > 0 && amount.trim().length > 0 && expenseDate.trim().length > 0
  }, [description, amount, expenseDate])

  // NEW: filtered view
  const filteredExpenses = useMemo(() => {
    if (filter === 'All') return expenses
    return expenses.filter(e => e.receipt_status === filter)
  }, [expenses, filter])

  const exportExpenses = useMemo(() => {
    return expenses.filter(expense => (
      matchesExportFilters(expense, exportStartDate, exportEndDate, exportStatus)
    ))
  }, [expenses, exportEndDate, exportStartDate, exportStatus])

  useEffect(() => {
    fetchExpenses()
  }, [])

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
    setReceiptStatus('Pending')
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
    setCategory(isCategoryOption(exp.category) ? exp.category : 'Food & Drinks')
    setCountry(exp.country ?? 'United Kingdom')
    setExpenseDate(exp.expense_date ?? '')
    setReceiptStatus(exp.receipt_status ?? 'Pending')
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
      const { error: removeError } = await supabase.storage.from('receipts').remove([existingReceiptPath])
      if (removeError) {
        showToast('error', `Could not remove receipt: ${removeError.message}`)
        return
      }

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
            receipt_status: receiptStatus,
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
          return
        }

        const receiptPath = await upsertReceipt(inserted.id)
        if (receiptPath) {
          await supabase.from('expenses').update({ receipt_path: receiptPath }).eq('id', inserted.id)
          showToast('success', 'Expense and receipt saved ✅')
        } else {
          showToast('success', 'Expense saved ✅')
        }
      } else {
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
            receipt_status: receiptStatus,
            country,
            expense_date: expenseDate,
          })
          .eq('id', id)

        if (updateError) {
          showToast('error', `Update failed: ${updateError.message}`)
          return
        }

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
    if (exportStartDate && exportEndDate && exportStartDate > exportEndDate) {
      showToast('error', 'Export start date must be before the end date.')
      return
    }

    if (exportExpenses.length === 0) {
      showToast('error', 'No expenses match those export filters.')
      return
    }

    try {
      const zip = new JSZip()
      zip.file('expenses.csv', toCSV(exportExpenses))

      const receiptsFolder = zip.folder('receipts')
      for (const exp of exportExpenses) {
        if (!exp.receipt_path) continue
        const { data, error } = await supabase.storage.from('receipts').download(exp.receipt_path)
        if (!error && data) receiptsFolder?.file(exp.receipt_path, data)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `expenses_export_${new Date().toISOString().slice(0, 10)}.zip`)
      showToast('success', `Export downloaded (${exportExpenses.length} expenses) ✅`)
    } catch {
      showToast('error', 'Export failed. Please try again.')
    }
  }

  return (
    <div className="app-page space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f97363]">Receipts and claims</p>
          <h1 className="section-title">All Expenses</h1>
          <p className="section-subtitle">Track spending with receipts</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportZIP}
            className="btn-secondary px-3 py-2"
            type="button"
          >
            Export
          </button>
          <button
            onClick={openNew}
            className="btn-accent px-3 py-2"
            type="button"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Export filters */}
      <div className="app-card p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#172554]">Spreadsheet export</h2>
            <p className="text-sm text-[#667085]">
              Choose a date range and reimbursement status before exporting.
            </p>
          </div>
          <p className="w-fit shrink-0 rounded-full bg-[#fff1ee] px-3 py-1 text-sm font-semibold text-[#dc5a4d]">
            {exportExpenses.length} matched
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block min-w-0 space-y-1">
            <span className="text-sm font-medium text-[#344054]">From</span>
            <input
              className="form-field appearance-none"
              type="date"
              value={exportStartDate}
              onChange={e => setExportStartDate(e.target.value)}
            />
          </label>

          <label className="block min-w-0 space-y-1">
            <span className="text-sm font-medium text-[#344054]">To</span>
            <input
              className="form-field appearance-none"
              type="date"
              value={exportEndDate}
              onChange={e => setExportEndDate(e.target.value)}
            />
          </label>

          <label className="block min-w-0 space-y-1">
            <span className="text-sm font-medium text-[#344054]">Status</span>
            <select
              className="form-field"
              value={exportStatus}
              onChange={e => setExportStatus(e.target.value as ExportStatus)}
            >
              {EXPORT_STATUS_OPTIONS.map(status => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
          <button
            onClick={exportZIP}
            className="btn-primary w-full px-3 py-2 sm:w-auto"
            type="button"
          >
            Export filtered spreadsheet
          </button>
          <button
            onClick={() => {
              setExportStartDate('')
              setExportEndDate('')
              setExportStatus('All')
            }}
            className="btn-secondary w-full px-3 py-2 sm:w-auto"
            type="button"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* NEW: Filter bar */}
      <div className="app-card p-2">
        <div className="flex gap-2 overflow-x-auto">
          {FILTER_OPTIONS.map(opt => {
            const active = filter === opt
            return (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                type="button"
                className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium border transition ${
                  active ? 'bg-[#172554] text-white border-[#172554]' : 'bg-white text-[#344054] border-[#dbe3ef] hover:border-[#f97363]'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className="app-card-muted p-3">
        {loading && <p className="p-3 text-sm text-[#667085]">Loading…</p>}
        {!loading && filteredExpenses.length === 0 && (
          <p className="p-3 text-sm text-[#667085]">No expenses for this filter.</p>
        )}

        <div className="space-y-2">
          {filteredExpenses.map(exp => (
            <div key={exp.id} className="app-card p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#667085]">{exp.category}</p>
                    <span className={`text-xs border px-2 py-0.5 rounded-full ${statusPillClass(exp.receipt_status)}`}>
                      {exp.receipt_status}
                    </span>
                  </div>

                  <p className="font-semibold text-[#172554] truncate">{exp.title}</p>

                  <p className="text-xs text-[#667085] mt-1">
                    {exp.merchant ? `${exp.merchant} · ` : ''}
                    {exp.expense_date}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-semibold text-[#172554]">{formatMoney(exp.amount, exp.currency)}</p>
                  <p className="text-xs text-[#667085]">{exp.country}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="flex gap-3">
                  <button onClick={() => openEdit(exp)} className="font-medium text-[#f97363] active:opacity-70" type="button">
                    Edit
                  </button>

                  {exp.receipt_path && (
                    <button
                      onClick={() => openReceipt(exp.receipt_path!)}
                      className="font-medium text-[#f97363] active:opacity-70"
                      type="button"
                    >
                      Receipt
                    </button>
                  )}
                </div>

                <button onClick={() => deleteExpense(exp)} className="font-medium text-red-600 active:opacity-70" type="button">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom sheet (unchanged; keep your current sheet code) */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-[#172554]/45 backdrop-blur-[2px]" onClick={closeSheet} />

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-lg">
              <div className="rounded-t-lg bg-white border border-[#dbe3ef] shadow-2xl max-h-[88vh] flex flex-col">
                <div className="pt-3 flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-[#dbe3ef]" />
                </div>

                <div className="px-5 pt-3 pb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[#172554]">{isEditing ? 'Edit Expense' : 'Add New Expense'}</h2>
                  <button onClick={closeSheet} className="text-xl text-[#667085]" type="button" aria-label="Close">
                    ×
                  </button>
                </div>

                <div className="overflow-y-auto overscroll-contain px-5 pb-5">
                  <form id="expense-form" onSubmit={saveExpense} className="space-y-4">
                    {/* Receipt */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#344054]">Receipt Image</label>

                      <label className="block cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,application/pdf"

                          className="hidden"
                          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                        />

                        <div className="border-2 border-dashed border-[#dbe3ef] rounded-lg p-6 text-center text-[#667085] bg-[#f8fafc] transition hover:border-[#f97363]">
                          <div className="text-2xl mb-2">🧾</div>
                          <div className="font-semibold text-[#172554]">Tap to upload receipt</div>
                          <div className="text-xs text-[#667085]">PNG, JPG, PDF up to 10MB</div>

                          {receiptFile && (
                            <div className="mt-2 text-xs text-[#344054]">Selected: {receiptFile.name}</div>
                          )}
                        </div>
                      </label>

                      {isEditing && existingReceiptPath && (
                        <button
                          type="button"
                          onClick={removeReceipt}
                          disabled={saving}
                          className="w-full rounded-md border border-red-200 bg-red-50 text-red-700 py-3 text-[16px] font-medium disabled:opacity-50 active:scale-[0.99]"
                        >
                          Remove receipt
                        </button>
                      )}
                    </div>

                    {/* Receipt status */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#344054]">Receipt Status</label>
                      <select
                        className="form-field"
                        value={receiptStatus}
                        onChange={e => setReceiptStatus(e.target.value as ReceiptStatus)}
                      >
                        {RECEIPT_STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* rest of your fields */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#344054]">Business Trip</label>
                      <input
                        className="form-field"
                        value={businessTrip}
                        placeholder='e.g London Conference, Client Visit'
                        onChange={e => setBusinessTrip(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#344054]">Description *</label>
                      <input
                        className="form-field"
                        value={description}
                        placeholder='What was the expenses for?'
                        onChange={e => setDescription(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                      <input
                        type="number"
                        step="0.01"
                        className="form-field"
                        placeholder='0.00'
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        required
                      />
                      <select
                        className="form-field"
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                      >
                        <option>GBP</option>
                        <option>EUR</option>
                        <option>USD</option>
                        <option>CHF</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border: 2px">
                      
                      <select
                        className="form-field"
                        value={category}
                        
                        onChange={e => {
                          if (isCategoryOption(e.target.value)) {
                            setCategory(e.target.value)
                          }
                        }}
                      >
                        {CATEGORY_OPTIONS.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                          
                        ))}
                      </select>
                      <input
                        type="date"
                        className="form-field appearance-none h-12 leading-tight"
                        placeholder="Date"
                        value={expenseDate}
                        onChange={e => setExpenseDate(e.target.value)}
                        required
                      />
                    </div>

                    <input
                      className="form-field"
                      placeholder="Vendor / Merchant"
                      value={vendor}
                      onChange={e => setVendor(e.target.value)}
                    />

                    <input
                      className="form-field"
                      placeholder="Notes"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />

                    <input
                      className="form-field"
                      placeholder="Country"
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                    />

                    <div className="h-24" />
                  </form>
                </div>

                <div className="border-t border-[#dbe3ef] bg-white p-4">
                  <button
                    form="expense-form"
                    type="submit"
                    disabled={!canSave || saving}
                    className="w-full btn-primary py-3 text-[16px]"
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
