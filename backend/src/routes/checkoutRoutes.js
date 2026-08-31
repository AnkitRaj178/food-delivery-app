import rateLimit from 'express-rate-limit'
import { Router } from 'express'
import mongoose from 'mongoose'
import Restaurant from '../models/Restaurant.js'
import Order from '../models/Order.js'
import PendingOrder from '../models/PendingOrder.js'
import { requireAuth } from '../middleware/auth.js'
import { calculateDeliveryFeeCents, getDrivingDistanceMeters } from '../utils/distanceMatrix.js'
import { calculateRealETA } from '../utils/etaCalculator.js'
import { getStripeClient } from '../utils/stripe.js'

const router = Router()

// 10 checkout-intent requests per 5 minutes per IP
const checkoutLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

const DEFAULT_TAX_RATE = 0.08

function taxRate() {
  const raw = Number(process.env.SALES_TAX_RATE)
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_TAX_RATE
}

function asPositiveInt(v) {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

function extractCartItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw Object.assign(new Error('Cart must include at least one item'), { status: 400 })
  }

  return rawItems.map((item) => {
    const menuItemId = typeof item?.menuItemId === 'string' ? item.menuItemId.trim() : ''
    const quantity = asPositiveInt(item?.quantity)
    if (!menuItemId || !quantity) {
      throw Object.assign(new Error('Each cart item requires menuItemId and quantity'), {
        status: 400,
      })
    }
    return { menuItemId, quantity }
  })
}

function normalizeDeliveryAddress(rawAddress) {
  const formattedAddress =
    typeof rawAddress?.formattedAddress === 'string' ? rawAddress.formattedAddress.trim() : ''
  const lat = Number(rawAddress?.lat)
  const lng = Number(rawAddress?.lng)

  if (!formattedAddress || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw Object.assign(new Error('A valid delivery address is required'), { status: 400 })
  }

  return {
    formattedAddress,
    lat,
    lng,
  }
}

router.post('/intent', requireAuth, checkoutLimiter, async (req, res, next) => {
  try {
    const restaurantId =
      typeof req.body?.restaurantId === 'string' ? req.body.restaurantId.trim() : ''
    const cartItems = extractCartItems(req.body?.items)
    const deliveryAddress = normalizeDeliveryAddress(req.body?.deliveryAddress)

    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurantId is required' })
    }

    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
      isActive: true,
    }).lean()

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' })
    }

    const menuById = new Map(
      (restaurant.menuItems ?? []).map((item) => [item._id.toString(), item])
    )

    const pricedItems = cartItems.map((cartItem) => {
      const menuItem = menuById.get(cartItem.menuItemId)
      if (!menuItem || menuItem.isAvailable === false) {
        throw Object.assign(new Error('One or more cart items are unavailable'), { status: 400 })
      }
      return {
        menuItemId: cartItem.menuItemId,
        name: menuItem.name,
        quantity: cartItem.quantity,
        unitPriceCents: menuItem.priceCents,
        lineTotalCents: menuItem.priceCents * cartItem.quantity,
      }
    })

    const subtotalCents = pricedItems.reduce((sum, item) => sum + item.lineTotalCents, 0)
    const restaurantCoords = restaurant.location?.coordinates
    if (!Array.isArray(restaurantCoords) || restaurantCoords.length !== 2) {
      throw Object.assign(new Error('Restaurant is missing coordinates'), { status: 500 })
    }

    console.log('[checkout] ORS coordinates', {
      restaurant: {
        lng: restaurantCoords[0],
        lat: restaurantCoords[1],
        asArray: [restaurantCoords[0], restaurantCoords[1]],
      },
      user: {
        lng: deliveryAddress.lng,
        lat: deliveryAddress.lat,
        asArray: [deliveryAddress.lng, deliveryAddress.lat],
      },
    })

    const drivingDistanceMeters = await getDrivingDistanceMeters(
      { lat: restaurantCoords[1], lng: restaurantCoords[0] },
      { lat: deliveryAddress.lat, lng: deliveryAddress.lng }
    )
    const deliveryFeeCents = calculateDeliveryFeeCents(drivingDistanceMeters)
    const taxCents = Math.round(subtotalCents * taxRate())
    const totalCents = subtotalCents + taxCents + deliveryFeeCents

    // Dynamic ETA via free OSRM API (gracefully falls back if unreachable)
    const etaMinutes = await calculateRealETA({
      restaurantCoords: { lat: restaurantCoords[1], lng: restaurantCoords[0] },
      userCoords: { lat: deliveryAddress.lat, lng: deliveryAddress.lng },
      basePrepTime: restaurant.basePrepTime ?? 15,
      cartItemCount: cartItems.length,
    })

    // ── Upsert pending order ───────────────────────────────────────────────────
    // Search for ANY existing pending order for this user+restaurant regardless
    // of paymentAttempted state. This handles the "retry after ghost" scenario:
    // if the user had a paymentAttempted:true ghost from a previous attempt and
    // comes back to checkout, we recycle that same document instead of creating
    // a new one (which would produce a second "Payment Processing" card in Order
    // History). The recycled doc will have paymentAttempted reset to false below.
    const existingDraft = await PendingOrder.findOne({
      customer: req.userId,
      restaurant: restaurant._id,
    }).lean()

    const orderId = existingDraft
      ? existingDraft.orderId               // reuse the pre-reserved ID
      : new mongoose.Types.ObjectId()        // fresh ID for a brand-new draft

    const pendingOrderDoc = await PendingOrder.findOneAndUpdate(
      {
        // Match ANY existing pending order for this user+restaurant (attempted
        // or not) so a returning user always recycles the same document.
        customer: req.userId,
        restaurant: restaurant._id,
      },
      {
        $set: {
          orderId,
          paymentAttempted: false,   // reset: user is back on checkout, not yet paying
          paymentFailed: false,      // reset: clear any failure flag from the prior attempt
          items: pricedItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            externalItemId: item.menuItemId,
          })),
          deliveryAddress: {
            line1: deliveryAddress.formattedAddress,
            city: deliveryAddress.formattedAddress,
            location: {
              type: 'Point',
              coordinates: [deliveryAddress.lng, deliveryAddress.lat],
            },
          },
          subtotalCents,
          deliveryFeeCents,
          taxCents,
          totalCents,
          drivingDistanceMeters,
        },
      },
      {
        upsert: true,      // create if no matching draft exists
        new: true,         // return the updated/created doc
        setDefaultsOnInsert: true,
      }
    )


    const stripe = getStripeClient()
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: req.userId,
        restaurantId: restaurant._id.toString(),
        pendingOrderId: pendingOrderDoc._id.toString(),
        orderId: orderId.toString(),
      },
    })

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId: orderId.toString(),
      pendingOrderId: pendingOrderDoc._id.toString(),
      summary: {
        restaurant: {
          id: restaurant._id.toString(),
          name: restaurant.name,
        },
        items: pricedItems,
        subtotalCents,
        taxCents,
        deliveryFeeCents,
        totalCents,
        drivingDistanceMeters,
        etaMinutes,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
