/**
 * auth.test.js
 *
 * Tests for POST /api/auth/register and POST /api/auth/login.
 *
 * External deps mocked:
 *   - socket.js  → getIo() so route imports don't throw at module load time
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import { connect, clearCollections, disconnect } from './helpers/db.js'

// ── Mock socket.io so routes that import getIo() don't throw ────────────────
vi.mock('../socket.js', () => ({
  getIo: () => ({ to: () => ({ emit: () => {} }) }),
  initSocket: () => {},
}))

// Set required env vars before importing anything that reads them
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-32'
process.env.NODE_ENV = 'test'

const { buildApp } = await import('./helpers/app.js')
const app = buildApp()

// ── DB lifecycle ─────────────────────────────────────────────────────────────
beforeAll(async () => { await connect() })
afterEach(async () => { await clearCollections() })
afterAll(async () => { await disconnect() })

// ── Helpers ──────────────────────────────────────────────────────────────────
const VALID_USER = { email: 'alice@example.com', password: 'securePass1', name: 'Alice' }

async function registerUser(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({ ...VALID_USER, ...overrides })
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('registers a new user and returns a JWT + user object', async () => {
    const res = await registerUser()

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      token: expect.any(String),
      user: {
        email: 'alice@example.com',
        name: 'Alice',
        id: expect.any(String),
      },
    })
    // Password must never appear in the response
    expect(JSON.stringify(res.body)).not.toContain('password')
  })

  it('returns 409 when the email is already taken', async () => {
    await registerUser()  // first registration succeeds
    const res = await registerUser()  // second should conflict

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already exists/i)
  })

  it('returns 400 when email is missing', async () => {
    const res = await registerUser({ email: '' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('returns 400 when password is missing', async () => {
    const res = await registerUser({ password: '' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('returns 400 when name is missing', async () => {
    const res = await registerUser({ name: '' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('returns 400 when password is shorter than 8 characters', async () => {
    const res = await registerUser({ password: 'short' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/at least 8/i)
  })

  it('normalises the email to lowercase', async () => {
    const res = await registerUser({ email: 'Alice@Example.COM' })

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('alice@example.com')
  })
})

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    // Pre-register the user once for all login tests
    await registerUser()
  })

  it('returns a JWT and user object on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      token: expect.any(String),
      user: { email: 'alice@example.com' },
    })
  })

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: 'wrongPassword!' })

    expect(res.status).toBe(401)
    // Must not reveal whether the email exists
    expect(res.body.error).toMatch(/invalid email or password/i)
  })

  it('returns 401 on unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: VALID_USER.password })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid email or password/i)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: VALID_USER.password })

    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email })

    expect(res.status).toBe(400)
  })
})
