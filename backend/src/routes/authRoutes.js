import rateLimit from 'express-rate-limit'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { requireAuth, signUserToken } from '../middleware/auth.js'

const router = Router()

const MIN_PASSWORD = 8

// 5 attempts per 15 minutes per IP — applied only to auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,   // send RateLimit-* headers (RFC 6585)
  legacyHeaders: false,    // suppress X-RateLimit-* headers
  message: { error: 'Too many attempts, please try again later.' },
  // Skip rate limiting in test environments so tests don't hit 429
  skip: () => process.env.NODE_ENV === 'test',
})


router.post('/register', authLimiter, async (req, res, next) => {

  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' })
    }
    if (password.length < MIN_PASSWORD) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ email, passwordHash, name })

    const token = signUserToken(user._id)
    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }
    next(err)
  }
})

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const user = await User.findOne({ email }).select('+passwordHash').exec()
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = signUserToken(user._id)
    res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).lean().exec()
    if (!user) {
      return res.status(401).json({ error: 'Account not found' })
    }
    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
