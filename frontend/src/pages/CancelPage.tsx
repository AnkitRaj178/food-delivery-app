import { Link } from 'react-router-dom'

export default function CancelPage() {
  return (
    <div className="px-4 py-14">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Payment canceled</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Payment failed or was canceled. Please try again
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          No worries — you can go back to your cart and retry the payment.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/checkout"
            className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Back to cart
          </Link>
          <Link
            to="/restaurants"
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Browse restaurants
          </Link>
        </div>
      </div>
    </div>
  )
}

