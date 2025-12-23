export type Expense = {
  id: string
  title: string                 // we will use this as Description
  merchant: string | null       // Vendor / Merchant
  amount: number
  currency: string
  category: string
  status: 'Pending' | 'Reimbursed'
  reimbursable: boolean
  country: string
  notes: string | null
  expense_date: string
  created_at: string

  business_trip?: string | null
  receipt_path?: string | null
}
