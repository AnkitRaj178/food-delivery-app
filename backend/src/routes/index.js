import { Router } from 'express'
import addressRoutes from './addressRoutes.js'
import authRoutes from './authRoutes.js'
import checkoutRoutes from './checkoutRoutes.js'
import orderUpdatesRoutes from './orderUpdatesRoutes.js'
import ordersRoutes from './ordersRoutes.js'
import pushRoutes from './pushRoutes.js'
import restaurantRoutes from './restaurantRoutes.js'
import searchRoutes from './searchRoutes.js'
import stripeWebhookRoutes from './stripeWebhookRoutes.js'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ ok: true })
})

router.use('/auth', authRoutes)
router.use('/address', addressRoutes)
router.use('/checkout', checkoutRoutes)
router.use('/orders', ordersRoutes)
router.use('/order-updates', orderUpdatesRoutes)
router.use('/push', pushRoutes)
router.use('/restaurants', restaurantRoutes)
router.use('/search', searchRoutes)
router.use('/stripe', stripeWebhookRoutes)

export default router
