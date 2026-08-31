import admin from 'firebase-admin'

let initialized = false

function ensureInitialized() {
  if (initialized) return

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw Object.assign(
      new Error('FCM not configured: FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY required'),
      { status: 500 }
    )
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  })
  initialized = true
}

export async function sendPushToTokens(tokens, payload) {
  if (!tokens || tokens.length === 0) return { sent: 0, failed: 0 }
  ensureInitialized()

  const message = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data ?? {},
  }

  const result = await admin.messaging().sendEachForMulticast(message)
  return { sent: result.successCount, failed: result.failureCount }
}

