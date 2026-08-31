/** Express 404 handler — attach after all routes */
export function notFoundHandler(req, res, next) {
  next(Object.assign(new Error(`Not found: ${req.method} ${req.originalUrl}`), { status: 404 }))
}

/** Central error handler — four arguments required by Express */
export function errorHandler(err, req, res, next) {
  try {
    // Lazy import so Sentry remains optional
    // eslint-disable-next-line no-undef
    const sentryDsn = process.env.SENTRY_DSN
    if (sentryDsn) {
      // eslint-disable-next-line no-undef
      import('@sentry/node').then((Sentry) => {
        Sentry.captureException(err)
      })
    }
  } catch {
    // ignore
  }

  let status =
    typeof err.status === 'number'
      ? err.status
      : typeof err.statusCode === 'number'
        ? err.statusCode
        : 500

  if (err.name === 'ValidationError') {
    status = 400
  }

  const message =
    status >= 500 && process.env.NODE_ENV !== 'development'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error'

  if (status >= 500) {
    console.error(err)
  }

  res.status(status).json({ error: message })
}
