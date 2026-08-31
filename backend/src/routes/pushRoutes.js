import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import UserPushToken from '../models/UserPushToken.js'

const router = Router()

router.post('/token', requireAuth, async (req, res, next) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    const platform = typeof req.body?.platform === 'string' ? req.body.platform.trim() : 'web'
    if (!token) return res.status(400).json({ error: 'token is required' })

    await UserPushToken.updateOne(
      { token },
      { $set: { user: req.userId, platform, lastSeenAt: new Date() } },
      { upsert: true }
    ).exec()

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/token', requireAuth, async (req, res, next) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    if (!token) return res.status(400).json({ error: 'token is required' })

    await UserPushToken.deleteOne({ token, user: req.userId }).exec()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router

