export default function RefundPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-left text-slate-700">
      <h1 className="text-3xl font-semibold text-slate-900">Refund Policy</h1>
      <p className="mt-2 text-sm text-slate-500">
        Last updated: May 4, 2026 &mdash; Placeholder document for approvals.
      </p>
      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">1. General</h2>
        <p>
          Refunds and adjustments for food orders are handled according to this policy.
          Customize amounts, timelines, and dispute flows to match your operations and Stripe
          settings.
        </p>
        <h2 className="text-xl font-semibold text-slate-900">2. Eligible issues</h2>
        <p>
          Examples often include incorrect or missing items, orders not received in materially
          different condition than described, or cancellation before preparation begins where
          applicable.
        </p>
        <h2 className="text-xl font-semibold text-slate-900">3. How to request</h2>
        <p>
          Customers should contact support within a defined window (for example 24&ndash;48 hours)
          with order details and, when helpful, photos. Replace with your in-app flow or email.
        </p>
        <h2 className="text-xl font-semibold text-slate-900">4. Resolution</h2>
        <p>
          Approved refunds may be issued to the original payment method or as account credit,
          consistent with law and processor rules.
        </p>
        <h2 className="text-xl font-semibold text-slate-900">5. Contact</h2>
        <p>Add your support URL or email here.</p>
      </section>
    </article>
  )
}
