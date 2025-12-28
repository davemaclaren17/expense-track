export type Expense = {
  id: string
  title: string
  merchant: string | null
  amount: number
  currency: string
  category: string

  status: 'Pending' | 'Reimbursed' // (your existing field; we’ll leave it alone)
  reimbursable: boolean

  country: string
  notes: string | null
  expense_date: string
  created_at: string

  business_trip?: string | null
  receipt_path?: string | null

  receipt_status?: 'Pending' | 'Approved' | 'Rejected' | 'Reimbursed'
}
