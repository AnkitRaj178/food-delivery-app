import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { ComponentType } from 'react'
import { useEffect } from 'react'
import type { LatLngBoundsExpression } from 'leaflet'

type LatLng = { lat: number; lng: number }

type OrderMapProps = {
  /** Delivery drop-off point (customer's address) */
  delivery: LatLng
  /** Restaurant pick-up point */
  restaurant: LatLng | null
  /** Live driver position */
  driver: LatLng | null
}

/** Inner component – has access to the Leaflet map instance via useMap() */
function MapController({ delivery, restaurant }: { delivery: LatLng; restaurant: LatLng | null }) {
  const map = useMap()

  useEffect(() => {
    if (restaurant) {
      // Fit both points with padding so neither sits right at the edge
      const bounds: LatLngBoundsExpression = [
        [delivery.lat, delivery.lng],
        [restaurant.lat, restaurant.lng],
      ]
      map.fitBounds(bounds, { padding: [48, 48] })
    } else {
      map.setView([delivery.lat, delivery.lng], 14)
    }
  // We only want to run fitBounds once when the key coordinates first arrive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.lat, restaurant?.lng, delivery.lat, delivery.lng])

  return null
}

export default function OrderMap({ delivery, restaurant, driver }: OrderMapProps) {
  // react-leaflet v4 types require this cast for strict TS projects
  const RLMapContainer = MapContainer as unknown as ComponentType<any>
  const RLTileLayer = TileLayer as unknown as ComponentType<any>
  const RLCircleMarker = CircleMarker as unknown as ComponentType<any>
  const RLTooltip = Tooltip as unknown as ComponentType<any>
  const RLPolyline = Polyline as unknown as ComponentType<any>
  const RLMapController = MapController as unknown as ComponentType<any>

  // Route line positions: restaurant → delivery
  const routePositions =
    restaurant
      ? [
          [restaurant.lat, restaurant.lng],
          [delivery.lat, delivery.lng],
        ]
      : null

  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
      <RLMapContainer
        center={[delivery.lat, delivery.lng]}
        zoom={13}
        scrollWheelZoom
        className="h-72 w-full"
      >
        <RLTileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fit both markers into view */}
        <RLMapController delivery={delivery} restaurant={restaurant} />

        {/* ── Dashed route line: Restaurant → Delivery ── */}
        {routePositions ? (
          <RLPolyline
            positions={routePositions}
            pathOptions={{
              color: '#f97316',
              weight: 3,
              dashArray: '8 6',
              dashOffset: '0',
              opacity: 0.85,
            }}
          />
        ) : null}

        {/* ── Restaurant marker (green) ── */}
        {restaurant ? (
          <RLCircleMarker
            center={[restaurant.lat, restaurant.lng]}
            radius={9}
            pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}
          >
            <RLTooltip permanent direction="top">
              🍽️ Restaurant
            </RLTooltip>
          </RLCircleMarker>
        ) : null}

        {/* ── Delivery marker (orange) ── */}
        <RLCircleMarker
          center={[delivery.lat, delivery.lng]}
          radius={9}
          pathOptions={{ color: '#ea580c', fillColor: '#f97316', fillOpacity: 1, weight: 2 }}
        >
          <RLTooltip permanent direction="top">
            📍 Delivery
          </RLTooltip>
        </RLCircleMarker>

        {/* ── Live driver marker (blue) ── */}
        {driver ? (
          <RLCircleMarker
            center={[driver.lat, driver.lng]}
            radius={8}
            pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
          >
            <RLTooltip permanent direction="top">
              🚗 Driver
            </RLTooltip>
          </RLCircleMarker>
        ) : null}
      </RLMapContainer>
    </div>
  )
}
