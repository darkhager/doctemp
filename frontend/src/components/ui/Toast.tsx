import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

type Kind = 'success' | 'error' | 'info'
interface ToastMsg { id: number; msg: string; kind: Kind }
interface Ctx { toast: (msg: string, kind?: Kind) => void }

const ToastCtx = createContext<Ctx>({ toast: () => {} })
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([])

  const toast = useCallback((msg: string, kind: Kind = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}
            onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}>
            {t.kind === 'success' ? '✓' : t.kind === 'error' ? '✕' : 'ℹ'}&nbsp; {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
