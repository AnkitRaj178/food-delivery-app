import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'
import { fetchOrderHistory, fetchRestaurantDetail, type OrderHistoryItem } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { useCartStore, type CartItem } from '../store/useCartStore'

type MenuMeta = {
  name: string
  description: string | null
  imageUrl: string | null
  priceCents: number
}

export default function OrderHistoryPage() {
  const token = useAppStore((s) => s.token)
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuMetaById, setMenuMetaById] = useState<Record<string, MenuMeta>>({})
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  })
  const toastTimeoutRef = useRef<number | null>(null)
  const setCart = useCartStore((s) => s.setCart)
  const navigate = useNavigate()

  function showToast(message: string) {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    setToast({ open: true, message })
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast((t) => ({ ...t, open: false }))
    }, 3000)
  }

  const activeOrder = useMemo(
    () => (activeOrderId ? orders.find((o) => o.id === activeOrderId) ?? null : null),
    [activeOrderId, orders]
  )

  const isModalOpen = Boolean(activeOrder)

  useEffect(() => {
    if (!isModalOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveOrderId(null)
    }
    window.addEventListener('keydown', onKeyDown)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [isModalOpen])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    const authToken = token
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchOrderHistory(authToken)
        if (!cancelled) setOrders(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load orders')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (orders.length === 0) return
    let cancelled = false

    const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurantId)))

    void (async () => {
      try {
        const restaurants = await Promise.all(
          restaurantIds.map((id) => fetchRestaurantDetail(id).catch(() => null))
        )

        if (cancelled) return

        setMenuMetaById((prev) => {
          const next = { ...prev }
          for (const r of restaurants) {
            if (!r) continue
            for (const m of r.menuItems) {
              if (!m.id) continue
              next[m.id] = {
                name: m.name,
                description: m.description ?? null,
                imageUrl: m.imageUrl ?? null,
                priceCents: m.priceCents,
              }
            }
          }
          return next
        })
      } catch {
        // If this fails, we still render using order snapshot data.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [orders])

  const totalOrders = useMemo(() => orders.length, [orders.length])

  async function onReorder(order: OrderHistoryItem) {
    if (!order.items.some((i) => i.menuItemId)) {
      setError('This order cannot be reordered (missing menu item ids).')
      return
    }
    try {
      setError(null)
      const restaurant = await fetchRestaurantDetail(order.restaurantId)

      const menuById = new Map(restaurant.menuItems.map((m) => [m.id, m]))

      const cartItems: CartItem[] = order.items
        .map((it) => {
          if (!it.menuItemId) return null
          const menuItem = menuById.get(it.menuItemId)
          if (!menuItem) return null
          return {
            menuItemId: it.menuItemId,
            name: menuItem.name,
            unitPriceCents: menuItem.priceCents,
            quantity: it.quantity,
            imageUrl: menuItem.imageUrl,
          }
        })
        .filter(Boolean) as CartItem[]

      if (cartItems.length === 0) {
        setError('None of the items from this order are available anymore.')
        return
      }

      setCart(
        { restaurantId: restaurant.id, restaurantName: restaurant.name },
        cartItems
      )
      navigate('/checkout')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reorder')
    }
  }

  return (
    <div className="px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Order history</h1>
          <p className="mt-1 text-sm text-slate-600">{totalOrders} order(s)</p>
        </div>
        <Link to="/restaurants" className="text-sm font-medium text-orange-600 hover:underline">
          Browse restaurants
        </Link>
      </div>

      {loading ? <p className="mt-8 text-slate-600">Loading orders…</p> : null}
      {error ? (
        <p className="mt-8 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && orders.length === 0 ? (
        <p className="mt-8 text-slate-600">No past orders yet.</p>
      ) : null}

      <ul className="mt-8 space-y-4">
        {orders.map((order) => (
          <li key={order.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                {/* Colour-coded status pill */}
                {order.paymentFailed ? (
                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    Payment Failed
                  </span>
                ) : order.isPendingPayment ? (
                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Payment Processing
                  </span>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-slate-900">{order.status}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  ${(order.totalCents / 100).toFixed(2)}
                </p>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveOrderId(order.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setActiveOrderId(order.id)
                }
              }}
              className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label="Open order details"
            >
              <ul className="space-y-2">
                {order.items.slice(0, 4).map((it, idx) => {
                  const meta = it.menuItemId ? menuMetaById[it.menuItemId] : undefined
                  const name = meta?.name ?? it.name
                  const description = meta?.description ?? null
                  const imageUrl = meta?.imageUrl ?? null
                  const unitPriceCents = meta?.priceCents ?? it.unitPriceCents
                  const lineTotalCents = unitPriceCents * it.quantity

                  return (
                    <li key={`${order.id}-${idx}`} className="flex items-center gap-3">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={name}
                          className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-white ring-1 ring-slate-200" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                {it.quantity}×
                              </span>
                              <span className="truncate text-sm font-semibold text-slate-900">
                                {name}
                              </span>
                            </div>
                            {description ? (
                              <p className="mt-1 line-clamp-1 text-xs text-slate-600">
                                {description}
                              </p>
                            ) : null}
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-xs text-slate-500">
                              ${(unitPriceCents / 100).toFixed(2)}
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              ${(lineTotalCents / 100).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}

                {order.items.length > 4 ? (
                  <li className="pt-1 text-xs font-medium text-slate-600">
                    + {order.items.length - 4} more item(s) — click to view details
                  </li>
                ) : (
                  <li className="pt-1 text-xs font-medium text-slate-600">
                    Click to view full order details
                  </li>
                )}
              </ul>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {order.paymentFailed ? (
                /* ── Payment-failed CTA ── */
                <Link
                  to="/checkout"
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                >
                  🔄 Retry Checkout
                </Link>
              ) : order.isPendingPayment ? (
                /* ── Pending-payment CTA ── */
                <Link
                  to="/checkout"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                >
                  ⚠️ Complete Payment
                </Link>
              ) : (
                /* ── Confirmed-order CTAs ── */
                <>
                  <Link
                    to={`/order/${order.id}`}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    View status
                  </Link>
                  {order.status?.toLowerCase() !== 'delivered' ? (
                    <Link
                      to={`/order/${order.id}`}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 animate-pulse shadow-md flex items-center"
                    >
                      Track Live Order
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onReorder(order)}
                      className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                    >
                      Reorder
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {activeOrder ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Order details"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiveOrderId(null)
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Order details
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{activeOrder.status}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(activeOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveOrderId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-5">
              <ul className="space-y-3">
                {activeOrder.items.map((it, idx) => {
                  const meta = it.menuItemId ? menuMetaById[it.menuItemId] : undefined
                  const name = meta?.name ?? it.name
                  const description = meta?.description ?? null
                  const imageUrl = meta?.imageUrl ?? null
                  const unitPriceCents = meta?.priceCents ?? it.unitPriceCents
                  const lineTotalCents = unitPriceCents * it.quantity

                  return (
                    <li
                      key={`${activeOrder.id}-full-${idx}`}
                      className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={name}
                          className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-2xl bg-slate-100 ring-1 ring-slate-200" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                                {it.quantity}×
                              </span>
                              <p className="text-sm font-semibold text-slate-900">{name}</p>
                            </div>
                            {description ? (
                              <p className="mt-1 text-sm text-slate-600">{description}</p>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-slate-500">
                              ${(unitPriceCents / 100).toFixed(2)} each
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              ${(lineTotalCents / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-6 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">Total breakdown</h3>
                <dl className="mt-3 space-y-2 text-sm text-slate-700">
                  <div className="flex justify-between gap-4">
                    <dt>Items</dt>
                    <dd>${(activeOrder.subtotalCents / 100).toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Tax</dt>
                    <dd>${(activeOrder.taxCents / 100).toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Delivery</dt>
                    <dd>${(activeOrder.deliveryFeeCents / 100).toFixed(2)}</dd>
                  </div>
                  <div className="mt-3 flex justify-between gap-4 border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                    <dt>Total</dt>
                    <dd>${(activeOrder.totalCents / 100).toFixed(2)}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    showToast(`Support team contacted for Order ID: ${activeOrder.id}`)
                  }}
                >
                  Help / Request Refund
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Toast open={toast.open} message={toast.message} />
    </div>
  )
}

