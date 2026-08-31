/**
 * webhookIdempotency.test.js
 *
 * Tests for the Stripe webhook idempotency fix on payment_intent.succeeded:
 *   1. A single event correctly creates an Order and deletes the PendingOrder.
 *   2. Sending the exact same event twice does NOT create duplicate orders and
 *      does NOT return a 5xx error on the second call.
 *
 * External deps mocked:
 *   - ../../utils/stripe.js  → getStripeClient() + webhooks.constructEvent()
 *   - ../../utils/fcm.js     → sendPushToTokens()
 *   - ../../socket.js        → getIo()
 *
 * The Stripe webhook signature check is bypassed by mocking constructEvent to
 * return a pre-built event object directly.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { connect, clearCollections, disconnect } from './helpers/db.js'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Stripe: mock constructEvent to skip real signature verification.
// We control what event object is returned.
let mockConstructEvent = vi.fn()
vi.mock('../utils/stripe.js', () => ({
  getStripeClient: () => ({
    webhooks: { constructEvent: (...args) => mockConstructEvent(...args) },
  }),
}))

// FCM: suppress real push notifications
vi.mock('../utils/fcm.js', () => ({
  sendPushToTokens: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
}))

// Socket.io: suppress real socket emissions
vi.mock('../socket.js', () => ({
  getIo: () => ({ to: () => ({ emit: vi.fn() }) }),
  initSocket: () => {},
}))

// ── Env setup ────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-32'
process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake'
process.env.NODE_ENV = 'test'

// ── App + models ─────────────────────────────────────────────────────────────
const { buildApp } = await import('./helpers/app.js')
const { default: Order } = await import('../models/Order.js')
const { default: PendingOrder } = await import('../models/PendingOrder.js')
const { default: User } = await import('../models/User.js')
const { default: Restaurant } = await import('../models/Restaurant.js')

const app = buildApp()


// ── DB lifecycle ─────────────────────────────────────────────────────────────
beforeAll(async () => { await connect() })
afterEach(async () => { await clearCollections() })
afterAll(async () => { await disconnect() })

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Seeds a PendingOrder plus the referenced User and Restaurant documents.
 * Returns { pendingOrder, orderId } with IDs that can be embedded in a
 * fake Stripe PaymentIntent metadata object.
 */
async function seedPendingOrder() {
  const user = await User.create({
    email: 'webhook-user@example.com',
    passwordHash: '$2b$12$fakeHashForTestingOnly',
    name: 'Webhook Test User',
  })

  const restaurant = await Restaurant.create({
    name: 'Webhook Bistro',
    isActive: true,
    location: { type: 'Point', coordinates: [77.209, 28.6139] },
  })

  const orderId = new mongoose.Types.ObjectId()

  const pendingOrder = await PendingOrder.create({
    customer: user._id,
    restaurant: restaurant._id,
    orderId,
    items: [{ name: 'Burger', quantity: 1, unitPriceCents: 1200 }],
    deliveryAddress: {
      line1: '123 Test St',
      city: 'Delhi',
      location: { type: 'Point', coordinates: [77.22, 28.63] },
    },
    subtotalCents: 1200,
    deliveryFeeCents: 400,
    taxCents: 96,
    totalCents: 1696,
    drivingDistanceMeters: 5000,
  })

  return { pendingOrder, orderId, user, restaurant }
}

/**
 * Builds a fake Stripe payment_intent.succeeded event pointing at the given
 * pending order and order IDs.
 */
function buildSucceededEvent({ pendingOrderId, orderId }) {
  return {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_idempotency',
        metadata: {
          pendingOrderId: pendingOrderId.toString(),
          orderId: orderId.toString(),
        },
      },
    },
  }
}

/**
 * POST the raw webhook body to /api/stripe/webhook.
 * The Stripe-Signature header value doesn't matter here because
 * constructEvent is mocked to return the event directly.
 */
async function postWebhook(event) {
  mockConstructEvent.mockReturnValueOnce(event)
  return request(app)
    .post('/api/stripe/webhook')
    .set('stripe-signature', 'mocked-sig')
    .set('Content-Type', 'application/json')
    .send(Buffer.from(JSON.stringify(event)))
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Stripe webhook — payment_intent.succeeded idempotency', () => {
  it('creates exactly one Order and removes the PendingOrder on first delivery', async () => {
    const { pendingOrder, orderId } = await seedPendingOrder()

    const res = await postWebhook(
      buildSucceededEvent({
        pendingOrderId: pendingOrder._id,
        orderId,
      })
    )

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true })

    // Order must exist with status Placed
    const orders = await Order.find({})
    expect(orders).toHaveLength(1)
    expect(orders[0].status).toBe('Placed')
    expect(orders[0]._id.toString()).toBe(orderId.toString())

    // PendingOrder must be gone
    const remaining = await PendingOrder.find({})
    expect(remaining).toHaveLength(0)
  })

  it('does NOT create a duplicate Order when the same event is delivered twice', async () => {
    const { pendingOrder, orderId } = await seedPendingOrder()
    const event = buildSucceededEvent({ pendingOrderId: pendingOrder._id, orderId })

    // First delivery — succeeds
    const res1 = await postWebhook(event)
    expect(res1.status).toBe(200)

    // Second delivery — the pending order is already gone; should still return
    // 200 (not 500) so Stripe does not keep retrying.
    const res2 = await postWebhook(event)
    expect(res2.status).toBe(200)
    expect(res2.body).toEqual({ received: true })

    // Still only one order in the database
    const orders = await Order.find({})
    expect(orders).toHaveLength(1)
  })

  it('returns 200 even when the pendingOrderId is not found (event already processed)', async () => {
    // Send an event referencing a pending order that was never created
    const event = buildSucceededEvent({
      pendingOrderId: new mongoose.Types.ObjectId(),
      orderId: new mongoose.Types.ObjectId(),
    })

    const res = await postWebhook(event)

    // Must not 500 — Stripe would keep retrying a 5xx
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true })

    // No spurious orders created
    const orders = await Order.find({})
    expect(orders).toHaveLength(0)
  })
})
