import { Router } from 'express'
import Order from '../models/Order.js'
import PendingOrder from '../models/PendingOrder.js'
import { requireAuth } from '../middleware/auth.js'
import { getIo } from '../socket.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    // ── Freshness window: only surface pending orders created in the last 30 min ──
    // After 30 minutes a pending order is considered stale — either the Stripe
    // webhook already fired (PendingOrder deleted on success) or payment silently
    // failed. Stale entries would otherwise produce ghost "Payment Processing"
    // cards and a spurious green active-order banner indefinitely.
    const FRESHNESS_MS = 30 * 60 * 1000
    const freshnessCutoff = new Date(Date.now() - FRESHNESS_MS)

    // Fetch confirmed orders and still-pending (awaiting Stripe webhook) orders in parallel
    const [confirmedOrders, pendingOrders] = await Promise.all([
      Order.find({ customer: req.userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec(),
      PendingOrder.find({
        customer: req.userId,
        paymentAttempted: true,
        createdAt: { $gte: freshnessCutoff },
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
        .exec(),
    ])

    const mapped = [
      // Confirmed orders
      ...confirmedOrders.map((o) => ({
        id: o._id.toString(),
        status: o.status,
        restaurantId: o.restaurant.toString(),
        isPendingPayment: false,
        items: (o.items ?? []).map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          menuItemId: it.externalItemId ?? null,
        })),
        subtotalCents: o.subtotalCents,
        taxCents: o.taxCents,
        deliveryFeeCents: o.deliveryFeeCents,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),

      // Pending-payment orders (Stripe webhook not yet received)
      ...pendingOrders.map((p) => ({
        // Use the pre-reserved orderId so "Track" links are consistent
        id: p.orderId.toString(),
        status: 'Payment Processing',
        restaurantId: p.restaurant.toString(),
        isPendingPayment: true,
        paymentFailed: p.paymentFailed ?? false,
        items: (p.items ?? []).map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          menuItemId: it.externalItemId ?? null,
        })),
        subtotalCents: p.subtotalCents,
        taxCents: p.taxCents ?? 0,
        deliveryFeeCents: p.deliveryFeeCents,
        totalCents: p.totalCents,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    ]

    // Sort combined list newest-first
    mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    res.json({ orders: mapped })
  } catch (err) {
    next(err)
  }
})

// ── Mark a pending order as payment-attempted ──────────────────────────────
// Called by StripeCheckoutForm right before stripe.confirmPayment().
// Must be defined BEFORE the generic /:orderId route so Express doesn't
// mistake the literal segment "pending" for an orderId.
router.patch('/pending/:id/attempt', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params

    const order = await PendingOrder.findOneAndUpdate(
      { _id: id, customer: req.userId },
      { $set: { paymentAttempted: true } },
      { new: true }
    )

    if (!order) {
      return res.status(404).json({ error: 'Pending order not found' })
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── Mark a pending order as payment-failed (frontend fallback) ─────────────
// Called by OrderStatusPage when Stripe redirects back with redirect_status=failed.
// This is the safety net for when the stripe webhook is not reachable locally.
router.patch('/pending/:id/fail', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params

    const order = await PendingOrder.findOneAndUpdate(
      { _id: id, customer: req.userId },
      { $set: { paymentFailed: true } },
      { new: true }
    )

    if (!order) {
      return res.status(404).json({ error: 'Pending order not found' })
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.get('/:orderId', requireAuth, async (req, res, next) => {
  try {
    const orderId = String(req.params.orderId).trim()
    const order = await Order.findById(orderId)
      .populate('restaurant', 'location name')
      .lean()
      .exec()
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (String(order.customer) !== String(req.userId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Extract restaurant GeoJSON coordinates [lng, lat] → { lng, lat }
    const restaurantCoords = order.restaurant?.location?.coordinates
    const restaurantLocation =
      Array.isArray(restaurantCoords) && restaurantCoords.length === 2
        ? { lng: restaurantCoords[0], lat: restaurantCoords[1] }
        : null

    // Extract delivery drop-off coordinates stored on the order
    const deliveryCoords = order.deliveryAddress?.location?.coordinates
    const deliveryLocation =
      Array.isArray(deliveryCoords) && deliveryCoords.length === 2
        ? { lng: deliveryCoords[0], lat: deliveryCoords[1] }
        : null

    res.json({
      order: {
        id: order._id.toString(),
        status: order.status,
        restaurantId: order.restaurant?._id?.toString() ?? order.restaurant.toString(),
        restaurantName: order.restaurant?.name ?? null,
        restaurantLocation,
        deliveryLocation,
        subtotalCents: order.subtotalCents,
        taxCents: order.taxCents,
        deliveryFeeCents: order.deliveryFeeCents,
        totalCents: order.totalCents,
        drivingDistanceMeters: order.drivingDistanceMeters ?? null,
        driverLocation:
          order.driverLocation?.coordinates?.length === 2
            ? { lng: order.driverLocation.coordinates[0], lat: order.driverLocation.coordinates[1] }
            : null,
        ratingStars: order.ratingStars ?? null,
        ratedAt: order.ratedAt ?? null,
        updatedAt: order.updatedAt,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.post('/:orderId/rating', requireAuth, async (req, res, next) => {
  try {
    const orderId = String(req.params.orderId).trim()
    const stars = Number(req.body?.stars)
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : ''

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'stars must be an integer from 1 to 5' })
    }

    const order = await Order.findById(orderId).exec()
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (String(order.customer) !== String(req.userId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (order.status !== 'Delivered') {
      return res.status(400).json({ error: 'Rating is only allowed after delivery' })
    }
    if (order.ratingStars) {
      return res.status(409).json({ error: 'Order already rated' })
    }

    order.ratingStars = stars
    order.ratingComment = comment || undefined
    order.ratedAt = new Date()
    await order.save()

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.patch('/:orderId/status', requireAuth, async (req, res, next) => {
  try {
    const orderId = String(req.params.orderId).trim()
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : ''

    // State-machine: only the single valid next step is accepted.
    // Placed → Preparing → Ready → Out for Delivery → Delivered
    const TRANSITIONS = {
      'Placed':           'Preparing',
      'Preparing':        'Ready',
      'Ready':            'Out for Delivery',
      'Out for Delivery': 'Delivered',
    }

    const order = await Order.findById(orderId).exec()
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (String(order.customer) !== String(req.userId)) return res.status(403).json({ error: 'Forbidden' })

    const allowedNext = TRANSITIONS[order.status]
    if (!allowedNext || status !== allowedNext) {
      return res.status(400).json({
        error: `Invalid status transition from "${order.status}" to "${status}"`,
      })
    }

    order.status = status
    await order.save()

    getIo().to(orderId).emit('order_updated', {
      orderId,
      status: order.status,
      driverLocation:
        order.driverLocation?.coordinates?.length === 2
          ? { lng: order.driverLocation.coordinates[0], lat: order.driverLocation.coordinates[1] }
          : null,
      updatedAt: order.updatedAt,
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router

