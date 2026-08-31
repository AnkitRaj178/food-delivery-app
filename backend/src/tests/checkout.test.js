/**
 * checkout.test.js
 *
 * Tests for POST /api/checkout/intent — verifies that:
 *   1. Item prices come from the DB (not from the client)
 *   2. Unavailable menu items are rejected
 *   3. An invalid restaurantId is rejected
 *
 * External deps mocked:
 *   - ../../utils/stripe.js         → getStripeClient()
 *   - ../../utils/distanceMatrix.js → getDrivingDistanceMeters()
 *   - ../../utils/etaCalculator.js  → calculateRealETA()
 *   - ../../socket.js               → getIo()
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { connect, clearCollections, disconnect } from './helpers/db.js'

// ── Mocks (must be declared before any imports that transitively use them) ───

// Mock Stripe: paymentIntents.create returns a fake client_secret
vi.mock('../utils/stripe.js', () => ({
  getStripeClient: () => ({
    paymentIntents: {
      create: vi.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_abc',
      }),
    },
  }),
}))

// Mock distance matrix: return a fixed 5 km driving distance offline
vi.mock('../utils/distanceMatrix.js', () => ({
  getDrivingDistanceMeters: vi.fn().mockResolvedValue(5000),
  calculateDeliveryFeeCents: vi.fn().mockReturnValue(466), // 5000m ≈ 3.1mi × 150¢
}))

// Mock ETA calculator: return a fixed 30-minute estimate offline
vi.mock('../utils/etaCalculator.js', () => ({
  calculateRealETA: vi.fn().mockResolvedValue(30),
}))

// Mock socket so ordersRoutes/stripeWebhookRoutes don't throw at import time
vi.mock('../socket.js', () => ({
  getIo: () => ({ to: () => ({ emit: () => {} }) }),
  initSocket: () => {},
}))

// ── Env setup ────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-32'
process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
process.env.NODE_ENV = 'test'

// ── App + models (import after mocks are wired) ──────────────────────────────
const { buildApp } = await import('./helpers/app.js')
const { default: Restaurant } = await import('../models/Restaurant.js')
const { default: User } = await import('../models/User.js')
const { signUserToken } = await import('../middleware/auth.js')

const app = buildApp()


// ── DB lifecycle ─────────────────────────────────────────────────────────────
beforeAll(async () => { await connect() })
afterEach(async () => { await clearCollections() })
afterAll(async () => { await disconnect() })

// ── Seed helpers ─────────────────────────────────────────────────────────────
async function seedRestaurant(overrides = {}) {
  return Restaurant.create({
    name: 'Test Bistro',
    isActive: true,
    location: { type: 'Point', coordinates: [77.2090, 28.6139] }, // [lng, lat]
    menuItems: [
      { name: 'Burger', priceCents: 1200, isAvailable: true },
      { name: 'Pizza',  priceCents: 1500, isAvailable: false },
    ],
    ...overrides,
  })
}

async function seedUser() {
  return User.create({
    email: 'customer@example.com',
    passwordHash: '$2b$12$fakeHashForTestingOnlyNotRealBcrypt',
    name: 'Test Customer',
  })
}

function authHeader(userId) {
  return `Bearer ${signUserToken(userId)}`
}

const DELIVERY_ADDRESS = {
  formattedAddress: '123 Test St, Delhi',
  lat: 28.63,
  lng: 77.22,
  placeId: null,
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/checkout/intent', () => {
  it('creates a checkout intent using DB prices, ignoring any client price', async () => {
    const restaurant = await seedRestaurant()
    const user = await seedUser()
    const menuItemId = restaurant.menuItems[0]._id.toString()

    const res = await request(app)
      .post('/api/checkout/intent')
      .set('Authorization', authHeader(user._id))
      .send({
        restaurantId: restaurant._id.toString(),
        items: [
          {
            menuItemId,
            quantity: 2,
            // Client deliberately sends a fake price — must be ignored
            unitPriceCents: 1,
          },
        ],
        deliveryAddress: DELIVERY_ADDRESS,
      })

    expect(res.status).toBe(200)

    // subtotal must be 2 × DB price (1200¢), NOT 2 × client price (1¢)
    expect(res.body.summary.subtotalCents).toBe(2400)
    expect(res.body.summary.items[0].unitPriceCents).toBe(1200)

    // A Stripe client secret must be returned
    expect(res.body.clientSecret).toBe('pi_test_123_secret_abc')
  })

  it('rejects an unavailable menu item with 400', async () => {
    const restaurant = await seedRestaurant()
    const user = await seedUser()
    const unavailableItemId = restaurant.menuItems[1]._id.toString() // Pizza, isAvailable: false

    const res = await request(app)
      .post('/api/checkout/intent')
      .set('Authorization', authHeader(user._id))
      .send({
        restaurantId: restaurant._id.toString(),
        items: [{ menuItemId: unavailableItemId, quantity: 1 }],
        deliveryAddress: DELIVERY_ADDRESS,
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/unavailable/i)
  })

  it('returns 404 for an unknown restaurantId', async () => {
    const user = await seedUser()
    const fakeId = new mongoose.Types.ObjectId().toString()

    const res = await request(app)
      .post('/api/checkout/intent')
      .set('Authorization', authHeader(user._id))
      .send({
        restaurantId: fakeId,
        items: [{ menuItemId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
        deliveryAddress: DELIVERY_ADDRESS,
      })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 400 when restaurantId is missing', async () => {
    const user = await seedUser()

    const res = await request(app)
      .post('/api/checkout/intent')
      .set('Authorization', authHeader(user._id))
      .send({
        items: [{ menuItemId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
        deliveryAddress: DELIVERY_ADDRESS,
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 when cart is empty', async () => {
    const restaurant = await seedRestaurant()
    const user = await seedUser()

    const res = await request(app)
      .post('/api/checkout/intent')
      .set('Authorization', authHeader(user._id))
      .send({
        restaurantId: restaurant._id.toString(),
        items: [],
        deliveryAddress: DELIVERY_ADDRESS,
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/at least one item/i)
  })

  it('returns 401 without an auth token', async () => {
    const restaurant = await seedRestaurant()

    const res = await request(app)
      .post('/api/checkout/intent')
      .send({
        restaurantId: restaurant._id.toString(),
        items: [{ menuItemId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
        deliveryAddress: DELIVERY_ADDRESS,
      })

    expect(res.status).toBe(401)
  })
})
