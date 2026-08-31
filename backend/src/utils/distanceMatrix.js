const METERS_PER_MILE = 1609.344
const DELIVERY_CENTS_PER_MILE = 150

export async function getDrivingDistanceMeters(origin, destination) {
  const FALLBACK_DISTANCE_METERS = 5000

  const key = process.env.OPENROUTESERVICE_API_KEY
  if (!key) {
    console.warn('[ors] OPENROUTESERVICE_API_KEY not configured, using fallback distance', {
      fallbackMeters: FALLBACK_DISTANCE_METERS,
    })
    return FALLBACK_DISTANCE_METERS
  }

  const oLng = Number(origin?.lng)
  const oLat = Number(origin?.lat)
  const dLng = Number(destination?.lng)
  const dLat = Number(destination?.lat)

  if (![oLng, oLat, dLng, dLat].every((n) => typeof n === 'number' && Number.isFinite(n))) {
    console.warn('[ors] Invalid coordinates, using fallback distance', {
      origin,
      destination,
      fallbackMeters: FALLBACK_DISTANCE_METERS,
    })
    return FALLBACK_DISTANCE_METERS
  }

  const payload = {
    coordinates: [
      [oLng, oLat],
      [dLng, dLat],
    ],
  }

  try {
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const raw = await response.text().catch(() => '')
      let parsed = null
      try {
        parsed = raw ? JSON.parse(raw) : null
      } catch {
        parsed = null
      }

      console.error('[ors] Directions request failed', {
        status: response.status,
        statusText: response.statusText,
        coordinates: payload.coordinates,
        errorBody: parsed ?? raw,
      })

      console.warn('[ors] Using fallback distance after ORS failure', {
        fallbackMeters: FALLBACK_DISTANCE_METERS,
      })
      return FALLBACK_DISTANCE_METERS
    }

    const data = await response.json().catch(async () => {
      const raw = await response.text().catch(() => '')
      throw new Error(`ORS response was not valid JSON. Body: ${raw}`)
    })

    const distance = data?.routes?.[0]?.summary?.distance
    if (typeof distance !== 'number' || !Number.isFinite(distance)) {
      console.error('[ors] Unexpected response shape (missing distance)', {
        coordinates: payload.coordinates,
        response: data,
      })
      console.warn('[ors] Using fallback distance after unexpected ORS response', {
        fallbackMeters: FALLBACK_DISTANCE_METERS,
      })
      return FALLBACK_DISTANCE_METERS
    }

    return distance
  } catch (err) {
    console.error('[ors] Request threw error', {
      coordinates: payload.coordinates,
      message: err instanceof Error ? err.message : String(err),
      error: err,
    })
    console.warn('[ors] Using fallback distance after thrown error', {
      fallbackMeters: FALLBACK_DISTANCE_METERS,
    })
    return FALLBACK_DISTANCE_METERS
  }
}

export function calculateDeliveryFeeCents(distanceMeters) {
  const miles = distanceMeters / METERS_PER_MILE
  return Math.round(miles * DELIVERY_CENTS_PER_MILE)
}
