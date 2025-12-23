'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'

type ToastType = 'success' | 'error'

type Toast = {
  type: ToastType
  message: string
}

type ToastContextValue = {
  showToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider />')
  return ctx
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)

  function showToast(type: ToastType, message: string) {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 3000)
  }

  const value = useMemo(() => ({ showToast }), [])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Global Toast UI (fixed, mobile-friendly) */}
      {toast && (
        <div className="fixed left-0 right-0 bottom-4 z-50 px-4">
          <div
            className={`mx-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
