/**
 * helpers/app.js
 *
 * Creates a minimal Express app wired with the real route handlers but
 * without the network-binding parts of src/index.js (no server.listen,
 * no Socket.io init, no Sentry).  This is what supertest drives.
 *
 * Socket.io is mocked globally before this module is imported so that
 * route handlers calling getIo() don't throw.
 */

import express from 'express'
import cors from 'cors'
import routes from '../../routes/index.js'
import { errorHandler, notFoundHandler } from '../../middleware/errorHandlers.js'

export function buildApp() {
  const app = express()
  app.use(cors())
  // Raw body for Stripe webhook — must come before express.json()
  app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))
  app.use(express.json())
  app.use('/api', routes)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
