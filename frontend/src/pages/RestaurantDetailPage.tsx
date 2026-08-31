import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Toast from '../components/Toast'
import { fetchRestaurantDetail, type RestaurantDetailDto } from '../lib/api'
import { useCartStore } from '../store/useCartStore'

export default function RestaurantDetailPage() {
  const { idOrSlug } = useParams()
  const [restaurant, setRestaurant] = useState<RestaurantDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const addItem = useCartStore((s) => s.addItem)
  const pendingReplacement = useCartStore((s) => s.pendingReplacement)
  const confirmReplaceCart = useCartStore((s) => s.confirmReplaceCart)
  const cancelPendingReplacement = useCartStore((s) => s.cancelPendingReplacement)
  const cartItems = useCartStore((s) => s.items)
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  })
  const toastTimeoutRef = useRef<number | null>(null)
  const [recentlyAddedById, setRecentlyAddedById] = useState<Record<string, boolean>>({})
  const addedTimeoutsRef = useRef<Record<string, number>>({})

  function showToast(message: string) {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    setToast({ open: true, message })
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast((t) => ({ ...t, open: false }))
    }, 3000)
  }

  function flashAdded(menuItemId: string) {
    const existing = addedTimeoutsRef.current[menuItemId]
    if (existing) window.clearTimeout(existing)

    setRecentlyAddedById((prev) => ({ ...prev, [menuItemId]: true }))
    addedTimeoutsRef.current[menuItemId] = window.setTimeout(() => {
      setRecentlyAddedById((prev) => {
        const next = { ...prev }
        delete next[menuItemId]
        return next
      })
      delete addedTimeoutsRef.current[menuItemId]
    }, 2000)
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
      for (const id of Object.keys(addedTimeoutsRef.current)) {
        window.clearTimeout(addedTimeoutsRef.current[id])
      }
    }
  }, [])

  const activeItem = useMemo(() => {
    if (!activeItemKey) return null
    return restaurant?.menuItems?.find((item) => (item.id ?? item.name) === activeItemKey) ?? null
  }, [activeItemKey, restaurant])

  const isModalOpen = Boolean(activeItem)

  useEffect(() => {
    if (!isModalOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveItemKey(null)
    }
    window.addEventListener('keydown', onKeyDown)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [isModalOpen])

  const activeItemUnitPriceCents = activeItem?.priceCents ?? 0
  const totalCents = activeItem ? activeItemUnitPriceCents * quantity : 0

  useEffect(() => {
    if (!idOrSlug) return
    const target = idOrSlug
    const controller = new AbortController()

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchRestaurantDetail(target)
        if (controller.signal.aborted) return
        setRestaurant(data)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Failed to load restaurant details')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [idOrSlug])

  if (loading) {
    return (
      <div className="pb-12">
        <div className="h-56 animate-pulse overflow-hidden bg-slate-200 sm:h-72" />
        <div className="px-4 py-6">
          <div className="animate-pulse">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-2/3 rounded bg-slate-200" />
            <div className="mt-3 h-4 w-full max-w-2xl rounded bg-slate-200" />
            <div className="mt-2 h-4 w-4/5 max-w-xl rounded bg-slate-200" />
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="h-6 w-16 rounded-full bg-slate-200" />
              <div className="h-6 w-20 rounded-full bg-slate-200" />
              <div className="h-6 w-14 rounded-full bg-slate-200" />
            </div>

            <div className="mt-10 h-6 w-24 rounded bg-slate-200" />
            <ul className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 rounded-lg bg-slate-200" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="h-4 w-40 rounded bg-slate-200" />
                        <div className="h-4 w-16 rounded bg-slate-200" />
                      </div>
                      <div className="mt-2 h-3 w-full rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="px-4 py-10">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }
  if (!restaurant) {
    return (
      <div className="px-4 py-10">
        <p className="text-slate-700">Restaurant not found.</p>
        <Link to="/restaurants" className="mt-3 inline-flex text-sm font-medium text-orange-600">
          Back to restaurants
        </Link>
      </div>
    )
  }

  const hero =
    restaurant.coverImageUrl ??
    restaurant.logoImageUrl ??
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sample.jpg'

  return (
    <div className="pb-12">
      <div className="h-56 overflow-hidden bg-slate-100 sm:h-72">
        <img src={hero} alt={restaurant.name} className="h-full w-full object-cover" />
      </div>
      <div className="px-4 py-6">
        <Link to="/restaurants" className="text-sm text-orange-600 hover:underline">
          ← Back to discovery
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{restaurant.name}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{restaurant.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {restaurant.cuisineTags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
              {tag}
            </span>
          ))}
        </div>
        {cartItems.length > 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Cart has {cartItems.reduce((sum, item) => sum + item.quantity, 0)} item(s).
          </p>
        ) : null}

        <h2 className="mt-10 text-xl font-semibold text-slate-900">Menu</h2>
        {restaurant.menuItems.length === 0 ? (
          <p className="mt-3 text-slate-600">Menu will be available soon.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {restaurant.menuItems.map((item) => (
              <li
                key={`${item.id ?? item.name}`}
                className="rounded-xl bg-white ring-1 ring-slate-200"
              >
                <div
                  role="button"
                  tabIndex={item.isAvailable && item.id ? 0 : -1}
                  onClick={() => {
                    if (!item.isAvailable || !item.id) return
                    setQuantity(1)
                    setActiveItemKey(item.id ?? item.name)
                  }}
                  onKeyDown={(e) => {
                    if (!item.isAvailable || !item.id) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setQuantity(1)
                      setActiveItemKey(item.id ?? item.name)
                    }
                  }}
                  className={`group flex w-full items-start gap-3 rounded-xl p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                    item.isAvailable && item.id
                      ? 'hover:bg-slate-50'
                      : 'cursor-not-allowed opacity-70'
                  }`}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-16 w-16 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          ${(item.priceCents / 100).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          disabled={!item.isAvailable || !item.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!item.isAvailable || !item.id) return
                            addItem(
                              {
                                restaurantId: restaurant.id,
                                restaurantName: restaurant.name,
                              },
                              {
                                menuItemId: item.id,
                                name: item.name,
                                unitPriceCents: item.priceCents,
                                imageUrl: item.imageUrl,
                              },
                              1
                            )
                            flashAdded(item.id)
                            showToast(`✅ ${item.name} added to cart!`)
                          }}
                          className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            item.id && recentlyAddedById[item.id]
                              ? 'bg-emerald-600 hover:bg-emerald-600'
                              : 'bg-orange-600 hover:bg-orange-700'
                          }`}
                          aria-label={`Add ${item.name} to cart`}
                        >
                          {item.id && recentlyAddedById[item.id] ? '✓ Added' : '+ Add'}
                        </button>
                      </div>
                    </div>
                    {item.description ? (
                      <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    ) : null}
                    {!item.isAvailable ? (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Temporarily unavailable
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {activeItem ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Menu item details"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiveItemKey(null)
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="relative">
              {activeItem.imageUrl ? (
                <img
                  src={activeItem.imageUrl}
                  alt={activeItem.name}
                  className="h-56 w-full object-cover"
                />
              ) : (
                <div className="h-56 w-full bg-gradient-to-br from-slate-100 to-slate-200" />
              )}
              <button
                type="button"
                onClick={() => setActiveItemKey(null)}
                className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur hover:bg-white"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900">{activeItem.name}</h3>
                  {activeItem.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {activeItem.description}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Price
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    ${(activeItem.priceCents / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Quantity</div>
                  <div className="mt-0.5 text-xs text-slate-500">Minimum 1 item</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <div className="w-12 text-center text-base font-semibold text-slate-900">
                    {quantity}
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="mt-5 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                onClick={() => {
                  if (!activeItem.id) return
                  addItem(
                    {
                      restaurantId: restaurant.id,
                      restaurantName: restaurant.name,
                    },
                    {
                      menuItemId: activeItem.id,
                      name: activeItem.name,
                      unitPriceCents: activeItem.priceCents,
                      imageUrl: activeItem.imageUrl,
                    },
                    quantity
                  )
                  showToast(`✅ ${activeItem.name} added to cart!`)
                  setActiveItemKey(null)
                }}
              >
                Add to cart • ${(totalCents / 100).toFixed(2)}
              </button>

              <p className="mt-3 text-center text-xs text-slate-500">
                Total = unit price * quantity
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {pendingReplacement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Replace cart items?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Your cart already contains items from another restaurant. Clear the current cart and
              add this item from {pendingReplacement.restaurantName} instead?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={cancelPendingReplacement}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Keep current cart
              </button>
              <button
                type="button"
                onClick={confirmReplaceCart}
                className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Clear and add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Toast open={toast.open} message={toast.message} />
    </div>
  )
}
