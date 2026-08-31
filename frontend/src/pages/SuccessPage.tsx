import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCartStore } from '../store/useCartStore'

export default function SuccessPage() {
  const clearCart = useCartStore((s) => s.clearCart)
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')

  useEffect(() => {
    clearCart()
  }, [clearCart])

  return (
    <div className="px-4 py-14">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Payment successful
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Congratulations! Your order has been placed successfully
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Thank you for your purchase. You can track your order status anytime.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {orderId ? (
            <Link
              to={`/order/${orderId}`}
              className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              View order status
            </Link>
          ) : (
            <Link
              to="/orders"
              className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              View your orders
            </Link>
          )}

          <Link
            to="/restaurants"
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  )
}

