import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CategoryFilters from '../components/CategoryFilters'
import RestaurantCard from '../components/RestaurantCard'
import { fetchNearbyRestaurants, type RestaurantDto } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

export default function RestaurantsPage() {
  const deliveryAddress = useAppStore((s) => s.deliveryAddress)
  const setDeliveryAddress = useAppStore((s) => s.setDeliveryAddress)
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const demoCities = useMemo(
    () => [
      { label: 'Greater Noida', lng: 77.5011, lat: 28.4744 },
      { label: 'Pune', lng: 73.8567, lat: 18.5204 },
      { label: 'Bangalore', lng: 77.5946, lat: 12.9716 },
    ],
    []
  )

  useEffect(() => {
    if (!deliveryAddress) return
    const origin = deliveryAddress

    const controller = new AbortController()

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const rows = await fetchNearbyRestaurants(origin.lat, origin.lng)
        if (controller.signal.aborted) return
        setRestaurants(rows)
      } catch (e) {
        if (controller.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
          return
        }
        setError(e instanceof Error ? e.message : 'Failed to load restaurants')
      } finally {
        setLoading(false)
      }
    }

    void load()

    return () => controller.abort()
  }, [deliveryAddress])

  if (!deliveryAddress) return null

  const categories = useMemo(() => {
    const values = new Set<string>()
    for (const restaurant of restaurants) {
      for (const tag of restaurant.cuisineTags) values.add(tag)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [restaurants])

  const visibleRestaurants = useMemo(() => {
    if (!selectedCategory) return restaurants
    return restaurants.filter((r) => r.cuisineTags.includes(selectedCategory))
  }, [restaurants, selectedCategory])

  return (
    <div className="px-4 py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nearby restaurants</h1>
          <p className="mt-1 text-sm text-slate-600">{deliveryAddress.formattedAddress}</p>
        </div>
        <Link
          to="/"
          className="text-sm font-medium text-orange-600 underline-offset-4 hover:underline"
        >
          Change address
        </Link>
      </div>

      <CategoryFilters
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading restaurants">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
            >
              <div className="aspect-[16/9] w-full bg-slate-200" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="h-4 w-2/3 rounded bg-slate-200" />
                  <div className="h-6 w-14 rounded-full bg-slate-200" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-full rounded bg-slate-200" />
                  <div className="h-3 w-4/5 rounded bg-slate-200" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-slate-200" />
                  <div className="h-5 w-20 rounded-full bg-slate-200" />
                  <div className="h-5 w-14 rounded-full bg-slate-200" />
                </div>
                <div className="mt-4 flex gap-3">
                  <div className="h-3 w-12 rounded bg-slate-200" />
                  <div className="h-3 w-10 rounded bg-slate-200" />
                  <div className="h-3 w-16 rounded bg-slate-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-10 text-red-600" role="alert">
          {error}
        </p>
      ) : restaurants.length === 0 ? (
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-orange-50 shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
              Demo Cities
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">
              Looks like you&apos;re outside our active delivery zones!
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              No worries—this portfolio build includes seeded restaurants in a few demo markets so
              recruiters can test the full experience instantly.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {demoCities.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null)
                    setDeliveryAddress({
                      formattedAddress: `Demo market: ${c.label}`,
                      lat: c.lat,
                      lng: c.lng,
                      placeId: null,
                    })
                  }}
                  className="group relative flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{c.label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Teleport to demo coordinates
                    </div>
                  </div>
                  <div className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 transition group-hover:bg-orange-100">
                    Try
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 text-xs text-slate-500">
              Tip: After teleporting, you can still filter by cuisine tags above.
            </div>
          </div>
        </div>
      ) : visibleRestaurants.length === 0 ? (
        <p className="mt-10 text-slate-600">No restaurants match this category in this market.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRestaurants.map((r) => {
            const dist =
              r.location
                ? distanceKm(
                    deliveryAddress.lat,
                    deliveryAddress.lng,
                    r.location.lat,
                    r.location.lng
                  )
                : null
            return (
              <li key={r.id}>
                <RestaurantCard restaurant={r} distanceKm={dist} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
