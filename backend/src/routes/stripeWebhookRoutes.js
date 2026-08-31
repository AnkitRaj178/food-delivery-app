import { Router } from 'express'
import Order from '../models/Order.js'
import PendingOrder from '../models/PendingOrder.js'
import UserPushToken from '../models/UserPushToken.js'
import { getStripeClient } from '../utils/stripe.js'
import { sendPushToTokens } from '../utils/fcm.js'
import { getIo } from '../socket.js'

const router = Router()

function webhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw Object.assign(new Error('STRIPE_WEBHOOK_SECRET is not configured'), { status: 500 })
  }
  return secret
}

router.post('/webhook', async (req, res, next) => {
  try {
    const stripe = getStripeClient()
    const signature = req.headers['stripe-signature']
    if (!signature) return res.status(400).send('Missing stripe-signature')

    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret())

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object
      const pendingOrderId = pi.metadata?.pendingOrderId

      if (pendingOrderId) {
        // Atomically claim and remove the pending order in a single round-trip.
        // If Stripe delivers the same event twice concurrently, only one request
        // will get a non-null result here; the other short-circuits below.
        const pendingOrder = await PendingOrder.findByIdAndDelete(pendingOrderId).lean().exec()

        if (pendingOrder) {
          const orderId = pi.metadata?.orderId || pendingOrder.orderId

          let order
          try {
            order = await Order.create({
              _id: orderId,
              customer: pendingOrder.customer,
              restaurant: pendingOrder.restaurant,
              items: pendingOrder.items,
              status: 'Placed',
              deliveryAddress: pendingOrder.deliveryAddress,
              subtotalCents: pendingOrder.subtotalCents,
              deliveryFeeCents: pendingOrder.deliveryFeeCents,
              taxCents: pendingOrder.taxCents,
              totalCents: pendingOrder.totalCents,
              drivingDistanceMeters: pendingOrder.drivingDistanceMeters,
              paymentIntentId: pi.id
            })
          } catch (createErr) {
            // Duplicate key on _id or paymentIntentId means a concurrent request
            // already created the order — treat as success so Stripe stops retrying.
            if (createErr.code === 11000) {
              return res.json({ received: true })
            }
            throw createErr
          }

          if (order) {
            getIo().to(orderId.toString()).emit('order_updated', {
              orderId: orderId.toString(),
              status: order.status,
              driverLocation:
                order.driverLocation?.coordinates?.length === 2
                  ? { lng: order.driverLocation.coordinates[0], lat: order.driverLocation.coordinates[1] }
                  : null,
              updatedAt: order.updatedAt,
            })

            // Push notification to user devices (best-effort)
            try {
              const tokens = await UserPushToken.find({ user: order.customer })
                .select('token')
                .lean()
                .exec()
              await sendPushToTokens(
                tokens.map((t) => t.token),
                {
                  title: 'Order placed',
                  body: `Your order ${orderId.toString()} has been placed.`,
                  data: { orderId: orderId.toString(), status: order.status },
                }
              )
            } catch {
              // ignore push failures
            }
          } // Closes: if (order)
        } // Closes: if (pendingOrder)
      } // Closes: if (pendingOrderId)
    } // Closes: if (event.type === 'payment_intent.succeeded')

    // ── Payment failed ────────────────────────────────────────────────────────
    // Stripe fires this when a payment attempt is declined or otherwise fails.
    // We flip paymentFailed: true so the Order History UI can show a red badge
    // and a "Retry Checkout" button instead of the generic amber "Processing" one.
    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object
      const pendingOrderId = pi.metadata?.pendingOrderId

      if (pendingOrderId) {
        await PendingOrder.findByIdAndUpdate(pendingOrderId, {
          $set: { paymentFailed: true },
        }).exec()
      }
    }

    res.json({ received: true })
  } catch (err) {
    next(err)
  }

})

export default router

