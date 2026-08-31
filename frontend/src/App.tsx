import { BrowserRouter, Route, Routes } from 'react-router-dom'
import RootLayout from './layouts/RootLayout'
import CheckoutPage from './pages/CheckoutPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import OrderStatusPage from './pages/OrderStatusPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import RestaurantDetailPage from './pages/RestaurantDetailPage'
import RefundPolicyPage from './pages/RefundPolicyPage'
import RestaurantsPage from './pages/RestaurantsPage'
import SearchResultsPage from './pages/SearchResultsPage'
import TermsOfServicePage from './pages/TermsOfServicePage'
import { RequireAddressOutlet, RequireAuthOutlet } from './routing/outlets'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/refund" element={<RefundPolicyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route element={<RequireAddressOutlet />}>
            <Route path="/restaurants" element={<RestaurantsPage />} />
            <Route path="/restaurants/:idOrSlug" element={<RestaurantDetailPage />} />
          </Route>
          <Route element={<RequireAuthOutlet />}>
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order/:orderId" element={<OrderStatusPage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
