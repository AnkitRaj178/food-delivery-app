import Stripe from 'stripe'

let stripeClient

export function getStripeClient() {
  if (stripeClient) return stripeClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw Object.assign(new Error('STRIPE_SECRET_KEY is not configured'), { status: 500 })
  }

  stripeClient = new Stripe(secretKey)
  return stripeClient
}
