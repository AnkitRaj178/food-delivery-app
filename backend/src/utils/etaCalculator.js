/**
 * etaCalculator.js
 *
 * Uses the free, no-key-required OSRM public API to calculate realistic
 * driving duration between two coordinates, then adds kitchen prep time
 * and a traffic buffer to produce a total delivery ETA.
 *
 * OSRM public API docs: http://project-osrm.org/docs/v5.24.0/api/
 */

const OSRM_BASE = 'http://router.project-osrm.org/route/v1/driving'
const TRAFFIC_BUFFER_MINUTES = 5
const PREP_EXTRA_PER_ITEM_MINUTES = 2
const FALLBACK_DRIVING_MINUTES = 15 // used when OSRM is unreachable

/**
 * Fetch driving duration (in minutes) between two lat/lng points via OSRM.
 * Returns a numeric fallback value on any network/parse error instead of throwing.
 *
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<number>} driving time in minutes
 */
async function getDrivingMinutesOSRM(origin, destination) {
  const url =
    `${OSRM_BASE}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=false&steps=false`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AnkitFoodDeliveryApp/1.0' },
      signal: AbortSignal.timeout(8000), // 8-second hard timeout
    })

    if (!res.ok) {
      console.warn('[osrm] Non-OK response', { status: res.status, url })
      return FALLBACK_DRIVING_MINUTES
    }

    const data = await res.json().catch(() => null)

    // OSRM returns duration in seconds under routes[0].duration
    const durationSeconds = data?.routes?.[0]?.duration
    if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) {
      console.warn('[osrm] Unexpected response shape', { url, data })
      return FALLBACK_DRIVING_MINUTES
    }

    return durationSeconds / 60
  } catch (err) {
    console.warn('[osrm] Request failed, using fallback', {
      message: err instanceof Error ? err.message : String(err),
    })
    return FALLBACK_DRIVING_MINUTES
  }
}

/**
 * Calculate a realistic delivery ETA in minutes.
 *
 * Formula:
 *   Total ETA = basePrepTime + (cartItemCount × 2) + drivingMinutes + 5 (traffic buffer)
 *
 * @param {{
 *   restaurantCoords: { lat: number, lng: number },
 *   userCoords:       { lat: number, lng: number },
 *   basePrepTime:     number,   // kitchen prep minutes (from restaurant.basePrepTime)
 *   cartItemCount?:   number,   // number of distinct line items in the cart
 * }} params
 * @returns {Promise<number>} Total ETA rounded to the nearest minute
 */
export async function calculateRealETA({
  restaurantCoords,
  userCoords,
  basePrepTime,
  cartItemCount = 1,
}) {
  const drivingMinutes = await getDrivingMinutesOSRM(restaurantCoords, userCoords)
  const prepExtra = cartItemCount * PREP_EXTRA_PER_ITEM_MINUTES
  const total = basePrepTime + prepExtra + drivingMinutes + TRAFFIC_BUFFER_MINUTES
  return Math.round(total)
}
