import jwt from 'jsonwebtoken'

function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 16) {
    throw Object.assign(new Error('JWT_SECRET must be set to a secure value (min 16 chars)'), {
      status: 500,
    })
  }
  return secret
}

/** Verifies Bearer token and attaches `req.userId` */
export function requireAuth(req, res, next) {
  let secret
  try {
    secret = jwtSecret()
  } catch {
    console.error('JWT_SECRET is missing or insecure')
    return res.status(500).json({ error: 'Authentication is not configured' })
  }

  try {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'Sign in required' })
    }
    const payload = jwt.verify(token, secret)
    const sub = typeof payload.sub === 'string' ? payload.sub : String(payload.sub)
    if (!sub) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    req.userId = sub
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function signUserToken(userId) {
  return jwt.sign({ sub: String(userId) }, jwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}
