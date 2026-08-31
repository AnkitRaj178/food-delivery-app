import { Router } from 'express'
import Order from '../models/Order.js'
import UserPushToken from '../models/UserPushToken.js'
import { getIo } from '../socket.js'
import { sendPushToTokens } from '../utils/fcm.js'

const router = Router()

function assertInternalKey(req) {
  const expected = process.env.ORDER_UPDATE_KEY
  if (!expected) {
    throw Object.assign(new Error('ORDER_UPDATE_KEY is not configured'), { status: 500 })
  }
  const provided = req.headers['x-order-update-key']
  if (provided !== expected) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 })
  }
}

router.post('/:orderId', async (req, res, next) => {
  try {
    assertInternalKey(req)

    const orderId = String(req.params.orderId).trim()
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : ''
    const driverLat = req.body?.driverLat == null ? null : Number(req.body.driverLat)
    const driverLng = req.body?.driverLng == null ? null : Number(req.body.driverLng)

    if (!status) return res.status(400).json({ error: 'status is required' })

    const update = { status }
    if (Number.isFinite(driverLat) && Number.isFinite(driverLng)) {
      update.driverLocation = { type: 'Point', coordinates: [driverLng, driverLat] }
    }

    const order = await Order.findByIdAndUpdate(orderId, update, { new: true }).lean().exec()
    if (!order) return res.status(404).json({ error: 'Order not found' })

    getIo().to(orderId).emit('order_updated', {
      orderId,
      status: order.status,
      driverLocation:
        order.driverLocation?.coordinates?.length === 2
          ? { lng: order.driverLocation.coordinates[0], lat: order.driverLocation.coordinates[1] }
          : null,
      updatedAt: order.updatedAt,
    })

    // Push notification (best-effort)
    try {
      const tokens = await UserPushToken.find({ user: order.customer }).select('token').lean().exec()
      await sendPushToTokens(
        tokens.map((t) => t.token),
        {
          title: 'Order update',
          body: `Your order is now: ${order.status.replace(/_/g, ' ')}`,
          data: { orderId, status: order.status },
        }
      )
    } catch {
      // ignore push failures
    }

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router

