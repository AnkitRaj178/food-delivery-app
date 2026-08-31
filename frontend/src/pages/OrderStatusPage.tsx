import { io, type Socket } from 'socket.io-client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import OrderMap from '../components/OrderMap'
import { API_URL, fetchOrder, markPaymentFailed, submitOrderRating, updateOrderStatus, type OrderDto } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { useCartStore } from '../store/useCartStore'

type OrderUpdateEvent = {
  orderId: string
  status: string
  driverLocation: { lat: number; lng: number } | null
  updatedAt: string
}

export default function OrderStatusPage() {
  const { orderId } = useParams()
  const token = useAppStore((s) => s.token)
  const address = useAppStore((s) => s.deliveryAddress)
  const clearCart = useCartStore((s) => s.clearCart)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [order, setOrder] = useState<OrderDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSuccessBanner, setShowSuccessBanner] = useState(false)
  const [ratingStars, setRatingStars] = useState<number>(0)
  const [ratingComment, setRatingComment] = useState<string>('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingDone, setRatingDone] = useState(false)
  const [devUpdating, setDevUpdating] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  // ── Detect Stripe payment failure from redirect URL params ──────────────────
  // Stripe appends ?redirect_status=failed (or =canceled) on card decline.
  // Some setups also append ?canceled=true when the user closes the payment sheet.
  const redirectStatus = searchParams.get('redirect_status') ?? ''
  const paymentFailed =
    redirectStatus === 'failed' ||
    redirectStatus === 'canceled' ||
    searchParams.get('canceled') === 'true'

  // Delivery point: prefer the coordinates stored on the order, fall back to the
  // address saved in the app store, then a generic New Delhi coordinate.
  const deliveryCenter = useMemo(() => {
    if (order?.deliveryLocation) return order.deliveryLocation
    if (address) return { lat: address.lat, lng: address.lng }
    return { lat: 28.6139, lng: 77.209 } // fallback
  }, [address, order?.deliveryLocation])

  // ── Cart-clear: ONLY on confirmed payment success ───────────────────────────
  // Guard against clearing the cart when the user lands here after a failure.
  useEffect(() => {
    const success =
      searchParams.get('success') === 'true' &&
      redirectStatus !== 'failed' &&
      redirectStatus !== 'canceled'
    if (!success) return
    clearCart()
    setShowSuccessBanner(true)
    const next = new URLSearchParams(searchParams)
    next.delete('success')
    // Avoid re-triggering this effect / "URL trap" on further navigation.
    setSearchParams(next, { replace: true })
  }, [clearCart, redirectStatus, searchParams, setSearchParams])

  async function simulateAdminStatus(nextStatus: 'Preparing' | 'Ready' | 'Out for Delivery' | 'Delivered') {
    if (!token || !orderId) return
    setError(null)
    setDevUpdating(true)
    try {
      await updateOrderStatus(token, orderId, nextStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update order status')
    } finally {
      setDevUpdating(false)
    }
  }

  // ── Frontend fallback: flag PendingOrder as failed when webhook didn't fire ──
  // Stripe appends ?redirect_status=failed on card decline. If the webhook
  // didn't reach the local backend, this is the only signal we have.
  // We read pendingOrderId from the URL (embedded by CheckoutPage in returnUrl).
  useEffect(() => {
    const isFailed =
      redirectStatus === 'failed' ||
      redirectStatus === 'canceled'
    const pendingOrderId = searchParams.get('pendingOrderId')
    if (!isFailed || !pendingOrderId || !token) return

    // Fire-and-forget — best-effort; the webhook may have already done this
    void markPaymentFailed(token, pendingOrderId).catch(() => {
      // Silently ignore: either the order was already marked failed by the
      // webhook, or it expired — either way the UI is already showing the
      // correct Payment Failed screen.
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run only once on mount

  // ── Order fetch: skip entirely when payment failed ──────────────────────────
  useEffect(() => {
    if (paymentFailed) return          // no order was created — don't even try
    if (!orderId || !token) return
    const authToken = token
    const targetOrderId = orderId
    let cancelled = false
    async function load() {
      try {
        setError(null)
        const data = await fetchOrder(authToken, targetOrderId)
        if (!cancelled) setOrder(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load order')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [orderId, paymentFailed, token])

  // ── Socket: skip when payment failed (no order room to join) ───────────────
  useEffect(() => {
    if (paymentFailed) return
    if (!orderId) return

    const socket = io(API_URL, { transports: ['websocket'] })
    socketRef.current = socket

    socket.emit('join_room', orderId)
    socket.on('order_updated', (payload: OrderUpdateEvent) => {
      if (payload.orderId !== orderId) return
      setOrder((prev) =>
        prev
          ? { ...prev, status: payload.status, driverLocation: payload.driverLocation, updatedAt: payload.updatedAt }
          : prev
      )
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [orderId, paymentFailed])

  // ── Payment Failed early-return UI ──────────────────────────────────────────
  if (paymentFailed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          {/* Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-10 w-10 text-red-500"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="mt-6 text-2xl font-semibold text-slate-900">Payment Failed</h1>

          {/* Body copy */}
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Your payment could not be processed.{' '}
            <span className="font-medium text-slate-800">You have not been charged.</span>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Your cart is intact. You can go back and try a different payment method.
          </p>

          {/* CTA */}
          <button
            type="button"
            onClick={() => navigate('/checkout')}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            ← Return to Checkout
          </button>

          {/* Secondary link */}
          <Link
            to="/restaurants"
            className="mt-4 inline-block text-sm text-slate-500 hover:text-orange-600 hover:underline"
          >
            Browse restaurants instead
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Order status</h1>
          <p className="mt-1 text-sm text-slate-600">Order ID: {orderId}</p>
        </div>
        <Link to="/restaurants" className="text-sm font-medium text-orange-600 hover:underline">
          Browse more
        </Link>
      </div>

      {showSuccessBanner ? (
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Congratulations! Your payment was successful and your order is placed!
              </p>
              <p className="mt-1 text-sm text-emerald-800">
                Your cart has been cleared. You can track live updates below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSuccessBanner(false)}
              className="text-sm font-semibold text-emerald-900/80 hover:text-emerald-900"
              aria-label="Dismiss success message"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Current status</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{order?.status ?? 'Loading…'}</p>
            <p className="mt-1 text-xs text-slate-500">Updates arrive in real-time via Socket.io.</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Delivery to</p>
            <p className="mt-2 text-sm text-slate-700">
              {address?.formattedAddress ?? 'Address not set'}
            </p>
          </div>

          {order?.status?.toLowerCase() === 'delivered' ? (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs uppercase tracking-wide text-slate-500">Rate your order</p>
              {ratingDone || order.ratingStars ? (
                <p className="mt-2 text-sm font-medium text-slate-900">Thanks for your rating.</p>
              ) : (
                <>
                  <div className="mt-3 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`h-10 w-10 rounded-lg text-lg ${
                          ratingStars >= n ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                        onClick={() => setRatingStars(n)}
                        aria-label={`${n} star`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Optional feedback"
                    className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-orange-500/30 focus:border-orange-500 focus:ring-2"
                    rows={3}
                  />
                  <button
                    type="button"
                    disabled={!token || !orderId || ratingSubmitting}
                    className="mt-3 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                    onClick={() => {
                      if (ratingStars === 0) {
                        setError('Please select a rating before submitting.')
                        return
                      }
                      if (!token || !orderId) return
                      const authToken = token
                      const targetOrderId = orderId
                      void (async () => {
                        try {
                          setRatingSubmitting(true)
                          await submitOrderRating(authToken, targetOrderId, {
                            stars: ratingStars,
                            comment: ratingComment.trim() ? ratingComment.trim() : undefined,
                          })
                          setRatingDone(true)
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Could not submit rating')
                        } finally {
                          setRatingSubmitting(false)
                        }
                      })()
                    }}
                  >
                    {ratingSubmitting ? 'Submitting…' : 'Submit rating'}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <OrderMap
            delivery={deliveryCenter}
            restaurant={order?.restaurantLocation ?? null}
            driver={order?.driverLocation ?? null}
          />
          <p className="text-xs text-slate-500">
            The map shows the route from the restaurant to your delivery address.
            The driver marker updates instantly via Socket.io.
          </p>
        </section>
      </div>

      {import.meta.env.DEV && (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-slate-300 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">⚙️ Dev Tools: Simulate Admin Actions</p>
            <p className="text-xs text-slate-500">
              Live: <span className="font-medium text-slate-700">{order?.status ?? 'Loading…'}</span>
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!token || !orderId || devUpdating}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={() => {
                void simulateAdminStatus('Preparing')
              }}
            >
              Mark Preparing
            </button>
            <button
              type="button"
              disabled={!token || !orderId || devUpdating}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={() => {
                void simulateAdminStatus('Ready')
              }}
            >
              Mark Ready
            </button>
            <button
              type="button"
              disabled={!token || !orderId || devUpdating}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={() => {
                void simulateAdminStatus('Out for Delivery')
              }}
            >
              Mark Out for Delivery
            </button>

            <button
              type="button"
              disabled={!token || !orderId || devUpdating}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={() => {
                void simulateAdminStatus('Delivered')
              }}
            >
              Mark Delivered
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            These buttons call the backend, then the page updates instantly via the existing Socket.io
            `order_updated` event.
          </p>
        </div>
      )}

    </div>
  )
}

