import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-100/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          © {new Date().getFullYear()} Delivery
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link to="/terms" className="text-slate-600 hover:text-slate-900 hover:underline">
            Terms of Service
          </Link>
          <Link to="/privacy" className="text-slate-600 hover:text-slate-900 hover:underline">
            Privacy Policy
          </Link>
          <Link to="/refund" className="text-slate-600 hover:text-slate-900 hover:underline">
            Refund Policy
          </Link>
        </nav>
      </div>
    </footer>
  )
}

