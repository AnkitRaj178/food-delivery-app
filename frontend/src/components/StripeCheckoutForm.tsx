import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useState, type FormEvent } from 'react'
import { markPaymentAttempted } from '../lib/api'

type StripeCheckoutFormProps = {
  returnUrl: string
  token: string
  pendingOrderId: string
}

export default function StripeCheckoutForm({ returnUrl, token, pendingOrderId }: StripeCheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!stripe || !elements) {
      setMessage('Payment form is still loading')
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      await markPaymentAttempted(token, pendingOrderId)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not flag payment attempt')
      setSubmitting(false)
      return
    }

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    })

    if (result.error) {
      setMessage(result.error.message ?? 'Payment could not be submitted')
    }

    setSubmitting(false)
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <PaymentElement />
      {message ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="mt-4 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  )
}
