import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import { useAppStore } from '../store/useAppStore'
import { useCartStore } from '../store/useCartStore'
import ActiveOrderFloatingBanner from '../components/ActiveOrderFloatingBanner'

export default function RootLayout() {
  const deliveryAddress = useAppStore((s) => s.deliveryAddress)
  const cartCount = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0))
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Clear the search bar whenever the user leaves the /search page
  useEffect(() => {
    if (!location.pathname.startsWith('/search')) {
      setSearchQuery('')
    }
  }, [location.pathname])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    navigate(`/search?q=${encodeURIComponent(q)}`)
    // Blur the input so mobile keyboards close
    inputRef.current?.blur()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">

          {/* ── Brand ── */}
          <Link to="/" className="mr-2 text-lg font-semibold text-orange-600 shrink-0">
            Delivery
          </Link>

          {/* ── Global search bar (center, grows) ── */}
          <form
            onSubmit={handleSearch}
            role="search"
            className="flex flex-1 min-w-[180px] items-center gap-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 ring-orange-500/30 transition focus-within:border-orange-400 focus-within:ring-2"
          >
            {/* Search icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="mr-2 h-4 w-4 shrink-0 text-slate-400"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              ref={inputRef}
              id="global-search-input"
              type="search"
              placeholder="Search for a dish…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              aria-label="Search for food items"
              autoComplete="off"
            />
            {searchQuery.trim() ? (
              <button
                type="submit"
                className="ml-2 rounded-lg bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 transition shrink-0"
                aria-label="Search"
              >
                Go
              </button>
            ) : null}
          </form>

          {/* ── Nav links ── */}
          <nav className="flex flex-wrap items-center gap-4 text-sm text-slate-600 shrink-0">
            {deliveryAddress ? (
              <NavLink
                to="/restaurants"
                className={({ isActive }) =>
                  isActive ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }
              >
                Restaurants
              </NavLink>
            ) : null}
            <NavLink
              to="/checkout"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }
            >
              Checkout{cartCount > 0 ? ` (${cartCount})` : ''}
            </NavLink>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }
            >
              Profile
            </NavLink>
            <NavLink
              to="/orders"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }
            >
              Orders
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl">
        <Outlet />
      </main>
      <Footer />
      <ActiveOrderFloatingBanner />
    </div>
  )
}
