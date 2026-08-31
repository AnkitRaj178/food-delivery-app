import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

/** Guest browsing: require a delivery address (from Places) before restaurant list. */
export function RequireAddressOutlet() {
  const address = useAppStore((s) => s.deliveryAddress)
  if (!address) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

/** Checkout / profile: require JWT; entry from those links only (no global login wall). */
export function RequireAuthOutlet() {
  const token = useAppStore((s) => s.token)
  const location = useLocation()
  if (!token) {
    const redirect = encodeURIComponent(location.pathname)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <Outlet />
}
