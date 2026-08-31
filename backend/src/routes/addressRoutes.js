import { Router } from 'express'

const router = Router()

function isValidLng(v) {
  return Number.isFinite(v) && v >= -180 && v <= 180
}

function isValidLat(v) {
  return Number.isFinite(v) && v >= -90 && v <= 90
}

/**
 * Accepts a client-confirmed Google Places selection.
 * Validates payload; optional hook for analytics or future persistence.
 */
router.post('/', (req, res) => {
  const body = req.body ?? {}
  const formattedAddress =
    typeof body.formattedAddress === 'string' ? body.formattedAddress.trim() : ''
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const placeId = body.placeId == null ? null : String(body.placeId)

  if (!formattedAddress) {
    return res.status(400).json({ error: 'formattedAddress is required' })
  }
  if (!isValidLat(lat) || !isValidLng(lng)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers' })
  }

  res.status(200).json({
    ok: true,
    address: {
      formattedAddress,
      lat,
      lng,
      placeId,
    },
  })
})

export default router
