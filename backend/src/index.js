import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import http from 'http'
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { connectDB } from './config/db.js'
import './models/Order.js'
import './models/Restaurant.js'
import './models/User.js'
import './models/UserPushToken.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandlers.js'
import { initSocket } from './socket.js'
import { startCleanupJobs } from './utils/cleanupJobs.js'

const app = express()
const port = Number(process.env.PORT) || 5000
const server = http.createServer(app)
initSocket(server)

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.0),
  })

  
}

// Build allowed-origins list from FRONTEND_URL env var (comma-separated).
// Falls back to localhost:5173 for local dev when the variable is not set.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`))
      }
    },
    credentials: true,
  })
)

app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

app.use('/api', routes)

app.use(notFoundHandler)
app.use(errorHandler)

async function start() {
  await connectDB()
  startCleanupJobs()   // schedule stale PendingOrder removal (runs immediately + every 1 h)
  server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
