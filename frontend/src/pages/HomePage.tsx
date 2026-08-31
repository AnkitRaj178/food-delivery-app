import { useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AddressInput from '../components/AddressInput'
import { useAppStore } from '../store/useAppStore'

export default function HomePage() {
  const navigate = useNavigate()
  const deliveryAddress = useAppStore((s) => s.deliveryAddress)

  const afterAddress = useCallback(() => {
    navigate('/restaurants', { replace: true })
  }, [navigate])

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-orange-600">
          Food delivery
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Order from nearby spots
        </h1>
        <p className="mt-3 text-slate-600">
          No account needed to browse. Enter your delivery address, then explore restaurants near you.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-xl">
        <AddressInput onAddressCommitted={afterAddress} />
        {deliveryAddress ? (
          <div className="mt-8 rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium text-slate-900">Delivering to</p>
            <p className="mt-1 text-sm text-slate-600">{deliveryAddress.formattedAddress}</p>
            <Link
              to="/restaurants"
              className="mt-4 inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Continue to restaurants
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
