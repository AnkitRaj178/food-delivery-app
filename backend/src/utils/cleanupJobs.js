import PendingOrder from '../models/PendingOrder.js'

const ONE_HOUR_MS = 60 * 60 * 1000
const MAX_AGE_MS = 24 * ONE_HOUR_MS // delete pending orders older than 24 hours

/**
 * Deletes PendingOrders that are more than 24 hours old.
 *
 * Note: The PendingOrder schema also has a MongoDB TTL index as a first line of
 * defence. This setInterval acts as a belt-and-suspenders backup in case the
 * TTL reaper hasn't run yet or the expireAfterSeconds value was recently changed.
 */
async function cleanupStalePendingOrders() {
  const cutoff = new Date(Date.now() - MAX_AGE_MS)
  try {
    const result = await PendingOrder.deleteMany({
      createdAt: { $lt: cutoff },
    }).exec()

    if (result.deletedCount > 0) {
      console.log(`[cleanup] Removed ${result.deletedCount} stale PendingOrder(s) older than 24 h`)
    }
  } catch (err) {
    // Log but never crash the server — this is a background housekeeping job
    console.error('[cleanup] Failed to remove stale PendingOrders:', err)
  }
}

/**
 * Schedules the cleanup to run once on startup and then every hour.
 * Call this once from index.js after the database connection is established.
 */
export function startCleanupJobs() {
  // Run immediately at boot so stale docs from a previous server session are
  // cleared before any request is served.
  void cleanupStalePendingOrders()

  // Then repeat every hour
  setInterval(() => {
    void cleanupStalePendingOrders()
  }, ONE_HOUR_MS)

  console.log('[cleanup] Stale-order cleanup job scheduled (runs every 1 h, max age 24 h)')
}
