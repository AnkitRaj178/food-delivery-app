import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Toast from '../components/Toast'
import { searchMenuItems, type SearchResultItem } from '../lib/api'
import { useCartStore } from '../store/useCartStore'

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''

  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addItem = useCartStore((s) => s.addItem)
  const pendingReplacement = useCartStore((s) => s.pendingReplacement)
  const confirmReplaceCart = useCartStore((s) => s.confirmReplaceCart)
  const cancelPendingReplacement = useCartStore((s) => s.cancelPendingReplacement)

  const [recentlyAdded, setRecentlyAdded] = useState<Record<string, boolean>>({})
  const addedTimers = useRef<Record<string, number>>({})

  const [toast, setToast] = useState<{ open: boolean; message: string }>({ open: false, message: '' })
  const toastTimer = useRef<number | null>(null)

  function showToast(msg: string) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ open: true, message: msg })
    toastTimer.current = window.setTimeout(() => setToast((t) => ({ ...t, open: false })), 3000)
  }

  function flashAdded(id: string) {
    if (addedTimers.current[id]) window.clearTimeout(addedTimers.current[id])
    setRecentlyAdded((prev) => ({ ...prev, [id]: true }))
    addedTimers.current[id] = window.setTimeout(() => {
      setRecentlyAdded((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      delete addedTimers.current[id]
    }, 2000)
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      for (const id of Object.keys(addedTimers.current)) {
        window.clearTimeout(addedTimers.current[id])
      }
    }
  }, [])

  // Fetch results whenever query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    searchMenuItems(query.trim(), controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setResults(data)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Search failed')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [query])

  function handleAddToCart(item: SearchResultItem) {
    const result = addItem(
      { restaurantId: item.restaurantId, restaurantName: item.restaurantName },
      {
        menuItemId: item.menuItemId,
        name: item.name,
        unitPriceCents: item.priceCents,
        imageUrl: item.imageUrl,
      },
      1,
    )
    if (result.ok) {
      flashAdded(item.menuItemId)
      showToast(`✅ ${item.name} added to cart!`)
    }
    // If requiresConfirmation, the pendingReplacement modal will appear automatically
  }

  /* ─────────────────────────── render ─────────────────────────── */
  return (
    <div className="px-4 py-10">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {query ? (
              <>
                Results for{' '}
                <span className="text-orange-600">&ldquo;{query}&rdquo;</span>
              </>
            ) : (
              'Search'
            )}
          </h1>
          {!loading && query && (
            <p className="mt-1 text-sm text-slate-500">
              {results.length === 0 ? 'No items found.' : `${results.length} item${results.length !== 1 ? 's' : ''} found`}
            </p>
          )}
        </div>
        <Link to="/restaurants" className="text-sm font-medium text-orange-600 hover:underline">
          Browse restaurants →
        </Link>
      </div>

      {/* ── Error state ── */}
      {error ? (
        <p className="mt-6 text-sm text-red-600" role="alert">{error}</p>
      ) : null}

      {/* ── Loading skeleton ── */}
      {loading ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="animate-pulse rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="h-40 w-full rounded-xl bg-slate-200" />
              <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-full rounded bg-slate-200" />
              <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
              <div className="mt-4 flex items-center justify-between">
                <div className="h-5 w-16 rounded bg-slate-200" />
                <div className="h-8 w-20 rounded-full bg-slate-200" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── Empty state ── */}
      {!loading && query && results.length === 0 && !error ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <span className="text-5xl">🍽️</span>
          <p className="text-lg font-semibold text-slate-700">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-sm text-slate-500">
            Try a different dish name or browse restaurants to explore menus.
          </p>
        </div>
      ) : null}

      {/* ── Result cards ── */}
      {!loading && results.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <li
              key={`${item.restaurantId}-${item.menuItemId}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition hover:shadow-md hover:ring-slate-300"
            >
              {/* Item image */}
              {item.imageUrl ? (
                <div className="h-44 w-full overflow-hidden bg-slate-100">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-orange-50 to-slate-100 text-4xl">
                  🍴
                </div>
              )}

              {/* Card body */}
              <div className="flex flex-1 flex-col p-4">
                {/* Item name + price */}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold leading-snug text-slate-900">
                    {item.name}
                  </h2>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">
                    ${(item.priceCents / 100).toFixed(2)}
                  </span>
                </div>

                {/* Description */}
                {item.description ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                ) : null}

                {/* Restaurant attribution + rating + ETA — secondary text */}
                <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                  {/* Rating badge */}
                  {item.restaurantRating > 0 && item.restaurantRatingCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                      ⭐ {item.restaurantRating.toFixed(1)}
                      <span className="text-amber-500/80">({item.restaurantRatingCount})</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                      ⭐ New
                    </span>
                  )}
                  <span className="text-slate-300">•</span>
                  <span>{item.restaurantEtaMinutes} min</span>
                  <span className="text-slate-300">•</span>
                  <Link
                    to={`/restaurants/${item.restaurantId}`}
                    className="hover:text-orange-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.restaurantName}
                  </Link>
                </div>

                {/* Spacer + Add to cart */}
                <div className="mt-auto pt-4">
                  <button
                    type="button"
                    id={`add-to-cart-${item.menuItemId}`}
                    onClick={() => handleAddToCart(item)}
                    className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                      recentlyAdded[item.menuItemId]
                        ? 'bg-emerald-600 hover:bg-emerald-600'
                        : 'bg-orange-600 hover:bg-orange-700'
                    }`}
                    aria-label={`Add ${item.name} to cart`}
                  >
                    {recentlyAdded[item.menuItemId] ? '✓ Added to cart' : '+ Add to cart'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── Replace-cart confirmation modal ── */}
      {pendingReplacement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Replace cart items?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Your cart has items from another restaurant. Clear it and add this item from{' '}
              <span className="font-medium">{pendingReplacement.restaurantName}</span> instead?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={cancelPendingReplacement}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep current cart
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmReplaceCart()
                  showToast(`✅ ${pendingReplacement.item.name} added to cart!`)
                }}
                className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
              >
                Clear &amp; add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Toast open={toast.open} message={toast.message} />
    </div>
  )
}
