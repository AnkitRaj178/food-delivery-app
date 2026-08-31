import { Router } from 'express'
import Restaurant from '../models/Restaurant.js'

const router = Router()

/**
 * Static ETA estimate for listing pages — same formula as restaurantRoutes.js.
 * basePrepTime + 5 min traffic buffer + 15 min average drive, rounded to 5 min.
 * OSRM is intentionally NOT called here to avoid 50 serial HTTP requests per search.
 */
function staticEtaMinutes(basePrepTime = 15) {
  const raw = basePrepTime + 5 + 15
  return Math.round(raw / 5) * 5
}

/**
 * GET /api/search?q=<query>
 *
 * Full-text menu-item search across all active restaurants.
 * Returns matching items with the parent restaurant's id, name, rating, and ETA.
 */
router.get('/', async (req, res, next) => {
  try {
    const raw = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (!raw || raw.length < 1) {
      return res.json({ results: [] })
    }

    // Escape regex special characters so user input is treated literally
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(escaped, 'i')

    // Find all active restaurants that have at least one matching menu item
    const restaurants = await Restaurant.find({
      isActive: true,
      menuItems: {
        $elemMatch: {
          isAvailable: true,
          $or: [{ name: pattern }, { description: pattern }],
        },
      },
    })
      .select('_id name menuItems rating ratingCount basePrepTime')
      .lean()
      .exec()

    const results = []

    for (const restaurant of restaurants) {
      const etaMinutes = staticEtaMinutes(restaurant.basePrepTime)

      for (const item of restaurant.menuItems ?? []) {
        if (!item.isAvailable) continue
        if (!pattern.test(item.name) && !pattern.test(item.description ?? '')) continue

        results.push({
          // Item fields
          menuItemId: item._id.toString(),
          name: item.name,
          description: item.description ?? '',
          priceCents: item.priceCents,
          imageUrl: item.imageUrl ?? null,
          // Restaurant context
          restaurantId: restaurant._id.toString(),
          restaurantName: restaurant.name,
          restaurantRating: restaurant.rating ?? 0,
          restaurantRatingCount: restaurant.ratingCount ?? 0,
          restaurantEtaMinutes: etaMinutes,
        })
      }
    }

    // Sort: exact name matches first, then alphabetical
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === raw.toLowerCase()
      const bExact = b.name.toLowerCase() === raw.toLowerCase()
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return a.name.localeCompare(b.name)
    })

    // Deduplicate: keep only the first (best-ranked) item per restaurant
    const seenRestaurants = new Set()
    const deduplicated = results.filter((r) => {
      if (seenRestaurants.has(r.restaurantId)) return false
      seenRestaurants.add(r.restaurantId)
      return true
    })

    res.json({ results: deduplicated })
  } catch (err) {
    next(err)
  }
})

export default router
