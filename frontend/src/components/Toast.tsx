type ToastProps = {
  open: boolean
  message: string
}

export default function Toast({ open, message }: ToastProps) {
  return (
    <div
      className={`fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 transition-all duration-200 sm:bottom-6 ${
        open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-2xl bg-slate-900/95 px-4 py-3 text-sm font-medium text-white shadow-xl ring-1 ring-white/10 backdrop-blur">
        {message}
      </div>
    </div>
  )
}

