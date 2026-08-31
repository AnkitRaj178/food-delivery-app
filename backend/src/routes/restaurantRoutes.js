import { Router } from 'express'
import Restaurant from '../models/Restaurant.js'
import { isCdnImageUrl } from '../utils/imageCdn.js'
import { calculateRealETA } from '../utils/etaCalculator.js'

const router = Router()

const DEFAULT_RADIUS_KM = 25
const MAX_RADIUS_KM = 50
const NEARBY_RADIUS_KM = 10

function toNumber(v) {
  return Number(v)
}

function isValidLat(v) {
  return Number.isFinite(v) && v >= -90 && v <= 90
}

function isValidLng(v) {
  return Number.isFinite(v) && v >= -180 && v <= 180
}

function sanitizeImageUrl(url) {
  return isCdnImageUrl(url) ? url : null
}

/**
 * Static ETA estimate used on listing pages where we don't have the user's
 * exact location handy. Formula: basePrepTime + traffic buffer (5 min) +
 * a typical 15-min drive assumption. Rounded to nearest 5 min so it reads
 * naturally ("~35 min" not "37 min").
 *
 * OSRM is called with real coordinates only at checkout time.
 */
function staticEtaMinutes(basePrepTime = 15) {
  const raw = basePrepTime + 5 + 15 // prep + traffic buffer + avg drive
  return Math.round(raw / 5) * 5    // round to nearest 5
}

function mapRestaurantSummary(r) {
  return {
    id: r._id.toString(),
    name: r.name,
    description: r.description ?? '',
    cuisineTags: r.cuisineTags ?? [],
    slug: r.slug ?? null,
    addressLine1: r.addressLine1 ?? null,
    city: r.city ?? null,
    logoImageUrl: sanitizeImageUrl(r.logoImageUrl),
    coverImageUrl: sanitizeImageUrl(r.coverImageUrl),
    deliveryFeeCents: r.deliveryFeeCents ?? 0,
    minOrderCents: r.minOrderCents ?? 0,
    // Dynamic field: computed from basePrepTime, not read from DB
    etaMinutes: staticEtaMinutes(r.basePrepTime),
    basePrepTime: r.basePrepTime ?? 15,
    rating: r.rating ?? 0,
    ratingCount: r.ratingCount ?? 0,
    location:
      r.location?.coordinates?.length === 2
        ? {
            lng: r.location.coordinates[0],
            lat: r.location.coordinates[1],
          }
        : null,
  }
}

function mapRestaurantDetail(r) {
  return {
    ...mapRestaurantSummary(r),
    menuItems: (r.menuItems ?? []).map((item) => ({
      id: item._id?.toString?.() ?? null,
      name: item.name,
      description: item.description ?? '',
      priceCents: item.priceCents,
      imageUrl: sanitizeImageUrl(item.imageUrl),
      isAvailable: item.isAvailable !== false,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/restaurants?lat=&lng=&radiusKm=
// Returns a list of restaurants near the user.
// etaMinutes is a static estimate; precise ETA is computed at checkout via OSRM.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const lat = toNumber(req.query.lat)
    const lng = toNumber(req.query.lng)
    let radiusKm = toNumber(req.query.radiusKm)
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      radiusKm = DEFAULT_RADIUS_KM
    }
    radiusKm = Math.min(radiusKm, MAX_RADIUS_KM)

    const base = { isActive: true }
    let query

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      query = {
        ...base,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: radiusKm * 1000,
          },
        },
      }
    } else {
      query = base
    }

    const restaurants = await Restaurant.find(query).sort({ name: 1 }).limit(50).lean().exec()

    res.json({
      restaurants: restaurants.map(mapRestaurantSummary),
      meta: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, radiusKm } : null,
    })
  } catch (err) {
    next(err)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/restaurants/nearby?lat=&lng=
// Tighter radius convenience endpoint.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/nearby', async (req, res, next) => {
  try {
    const lat = toNumber(req.query.lat)
    const lng = toNumber(req.query.lng)

    if (!isValidLat(lat) || !isValidLng(lng)) {
      return res.status(400).json({ error: 'lat and lng query parameters are required' })
    }

    const restaurants = await Restaurant.find({
      isActive: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          $maxDistance: NEARBY_RADIUS_KM * 1000,
        },
      },
    })
      .limit(50)
      .lean()
      .exec()

    res.json({
      restaurants: restaurants.map(mapRestaurantSummary),
      meta: { lat, lng, radiusKm: NEARBY_RADIUS_KM },
    })
  } catch (err) {
    next(err)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/restaurants/:idOrSlug?userLat=&userLng=
// Detail page. If the caller passes userLat/userLng, we call OSRM for a
// precise ETA and return it; otherwise fall back to the static estimate.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:idOrSlug', async (req, res, next) => {
  try {
    const idOrSlug = String(req.params.idOrSlug).trim()

    const query = idOrSlug.match(/^[a-fA-F0-9]{24}$/)
      ? { _id: idOrSlug }
      : { slug: idOrSlug.toLowerCase() }

    const restaurant = await Restaurant.findOne({
      ...query,
      isActive: true,
    })
      .lean()
      .exec()

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' })
    }

    const mapped = mapRestaurantDetail(restaurant)

    // If the frontend passes the user's location, compute a precise OSRM ETA
    const userLat = toNumber(req.query.userLat)
    const userLng = toNumber(req.query.userLng)
    if (
      isValidLat(userLat) &&
      isValidLng(userLng) &&
      restaurant.location?.coordinates?.length === 2
    ) {
      const [rLng, rLat] = restaurant.location.coordinates
      mapped.etaMinutes = await calculateRealETA({
        restaurantCoords: { lat: rLat, lng: rLng },
        userCoords: { lat: userLat, lng: userLng },
        basePrepTime: restaurant.basePrepTime ?? 15,
        cartItemCount: 1, // no cart context on detail page; use 1 as baseline
      })
    }

    res.json({ restaurant: mapped })
  } catch (err) {
    next(err)
  }
})

export default router
