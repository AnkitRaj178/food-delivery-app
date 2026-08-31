import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import StripeCheckoutForm from '../components/StripeCheckoutForm'
import { createCheckoutIntent, type CheckoutSummary } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { useCartStore } from '../store/useCartStore'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

export default function CheckoutPage() {
  const user = useAppStore((s) => s.user)
  const token = useAppStore((s) => s.token)
  const address = useAppStore((s) => s.deliveryAddress)
  const restaurant = useCartStore((s) => s.restaurant)
  const items = useCartStore((s) => s.items)
  const incrementItem = useCartStore((s) => s.incrementItem)
  const decrementItem = useCartStore((s) => s.decrementItem)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [summary, setSummary] = useState<CheckoutSummary | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [loadingIntent, setLoadingIntent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const [showCanceledBanner, setShowCanceledBanner] = useState(false)

  const canInitializeCheckout = Boolean(token && address && restaurant && items.length > 0)
  const returnUrl = useMemo(() => {
    const base = window.location.origin
    // Embed pendingOrderId so OrderStatusPage can call /fail if payment is declined
    const params = new URLSearchParams({ success: 'true' })
    if (pendingOrderId) params.set('pendingOrderId', pendingOrderId)
    return orderId ? `${base}/order/${orderId}?${params.toString()}` : `${base}/checkout`
  }, [orderId, pendingOrderId])

  useEffect(() => {
    const canceled = searchParams.get('canceled') === 'true'
    if (!canceled) return
    setShowCanceledBanner(true)
  }, [searchParams])

  useEffect(() => {
    if (!canInitializeCheckout || !token || !address || !restaurant) {
      setClientSecret(null)
      setSummary(null)
      setOrderId(null)
      setPendingOrderId(null)
      return
    }
    const authToken = token
    const deliveryAddress = address
    const cartRestaurant = restaurant
    const cartItems = items

    // AbortController lets us cancel any in-flight fetch when the cart changes
    // or the component unmounts, so stale responses are never applied.
    const controller = new AbortController()

    async function initializeCheckout() {
      try {
        setLoadingIntent(true)
        setError(null)
        const data = await createCheckoutIntent(
          authToken,
          {
            restaurantId: cartRestaurant.restaurantId,
            items: cartItems.map((item) => ({
              menuItemId: item.menuItemId ?? '',
              quantity: item.quantity,
            })),
            deliveryAddress,
          },
          controller.signal,
        )
        // Guard: if this request was aborted while awaiting, discard the result.
        if (controller.signal.aborted) return
        setClientSecret(data.clientSecret)
        setSummary(data.summary)
        setOrderId(data.orderId)
        setPendingOrderId(data.pendingOrderId)
      } catch (err) {
        // AbortError is expected when a newer cart change cancels this request.
        if (controller.signal.aborted) return
        setClientSecret(null)
        setSummary(null)
        setOrderId(null)
        setPendingOrderId(null)
        setError(err instanceof Error ? err.message : 'Could not initialize payment')
      } finally {
        if (!controller.signal.aborted) setLoadingIntent(false)
      }
    }

    // Debounce: wait 600ms after the last cart change before firing the API call.
    // This prevents creating a new Stripe PaymentIntent on every +/- button click.
    const debounceTimer = setTimeout(() => {
      void initializeCheckout()
    }, 600)

    return () => {
      clearTimeout(debounceTimer)   // cancel the pending debounce if cart changes again
      controller.abort()            // cancel any in-flight fetch
    }
  }, [address, canInitializeCheckout, items, restaurant, token])


  return (
    <div className="px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Checkout</h1>
      <p className="mt-2 text-slate-600">
        Signed in as <span className="font-medium">{user?.email}</span>.
      </p>

      {showCanceledBanner ? (
        <div className="mt-6 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200" role="alert">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-rose-900">
                Payment failed or was canceled. Please try again.
              </p>
              <p className="mt-1 text-sm text-rose-800">
                Your cart is still saved — you can retry checkout below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCanceledBanner(false)}
              className="text-sm font-semibold text-rose-900/80 hover:text-rose-900"
              aria-label="Dismiss error message"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {address ? (
        <p className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
          Deliver to {address.formattedAddress}
        </p>
      ) : (
        <p className="mt-4 text-amber-800">
          No delivery address on file.&nbsp;
          <Link className="font-medium underline" to="/">
            Add an address first
          </Link>
          .
        </p>
      )}

      {!restaurant || items.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-slate-700">Your cart is empty.</p>
          <Link to="/restaurants" className="mt-3 inline-flex text-sm font-medium text-orange-600">
            Browse restaurants
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{restaurant.restaurantName}</h2>
                  <p className="text-sm text-slate-600">One restaurant per cart is enforced.</p>
                </div>
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  Clear cart
                </button>
              </div>
              <ul className="mt-4 space-y-3">
                {items.map((item) => (
                  <li
                    key={item.menuItemId}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-slate-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-600">
                        ${(item.unitPriceCents / 100).toFixed(2)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => decrementItem(item.menuItemId)}
                        className="h-8 w-8 rounded-md border border-slate-300 text-slate-700"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => incrementItem(item.menuItemId)}
                        className="h-8 w-8 rounded-md border border-slate-300 text-slate-700"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.menuItemId)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
              {loadingIntent ? <p className="mt-3 text-sm text-slate-600">Calculating totals…</p> : null}
              {error ? (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
              {summary ? (
                <>
                  <dl className="mt-4 space-y-2 text-sm text-slate-700">
                    <div className="flex justify-between gap-4">
                      <dt>Items</dt>
                      <dd>${(summary.subtotalCents / 100).toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Tax</dt>
                      <dd>${(summary.taxCents / 100).toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Delivery</dt>
                      <dd>${(summary.deliveryFeeCents / 100).toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 text-xs text-slate-500">
                      <dt>Driving distance</dt>
                      <dd>{(summary.drivingDistanceMeters / 1609.344).toFixed(1)} miles</dd>
                    </div>
                    <div className="mt-3 flex justify-between gap-4 border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                      <dt>Total</dt>
                      <dd>${(summary.totalCents / 100).toFixed(2)}</dd>
                    </div>
                  </dl>
                </>
              ) : null}
            </div>

            {!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
                Add `VITE_STRIPE_PUBLISHABLE_KEY` to enable Stripe Elements on the frontend.
              </p>
            ) : null}

            {clientSecret && stripePromise && pendingOrderId ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripeCheckoutForm returnUrl={returnUrl} token={token ?? ""} pendingOrderId={pendingOrderId} />
              </Elements>
            ) : null}
          </section>
        </div>
      )}
    </div>
  )
}
