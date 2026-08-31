export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export type AuthUser = {
  id: string
  email: string
  name: string
}

export async function postConfirmedAddress(address: {
  formattedAddress: string
  lat: number
  lng: number
  placeId: string | null
}): Promise<void> {
  const res = await fetch(`${API_URL}/api/address`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formattedAddress: address.formattedAddress,
      lat: address.lat,
      lng: address.lng,
      placeId: address.placeId,
    }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? 'Could not confirm address with the server')
  }
}

export async function loginRequest(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = (await res.json().catch(() => null)) as
    | { token?: string; user?: AuthUser; error?: string }
    | null
  if (!res.ok) {
    throw new Error(data?.error ?? 'Login failed')
  }
  if (!data?.token || !data.user) {
    throw new Error('Unexpected server response')
  }
  return { token: data.token, user: data.user }
}

export async function registerRequest(
  email: string,
  password: string,
  name: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  const data = (await res.json().catch(() => null)) as
    | { token?: string; user?: AuthUser; error?: string }
    | null
  if (!res.ok) {
    throw new Error(data?.error ?? 'Registration failed')
  }
  if (!data?.token || !data.user) {
    throw new Error('Unexpected server response')
  }
  return { token: data.token, user: data.user }
}

export type RestaurantDto = {
  id: string
  name: string
  description: string
  cuisineTags: string[]
  slug: string | null
  addressLine1: string | null
  city: string | null
  logoImageUrl: string | null
  coverImageUrl: string | null
  deliveryFeeCents: number
  minOrderCents: number
  etaMinutes: number
  basePrepTime: number
  rating: number
  ratingCount: number
  location: { lng: number; lat: number } | null
}

export type MenuItemDto = {
  id: string | null
  name: string
  description: string
  priceCents: number
  imageUrl: string | null
  isAvailable: boolean
}

export type RestaurantDetailDto = RestaurantDto & {
  menuItems: MenuItemDto[]
}

export type CheckoutSummary = {
  restaurant: {
    id: string
    name: string
  }
  items: Array<{
    menuItemId: string
    name: string
    quantity: number
    unitPriceCents: number
    lineTotalCents: number
  }>
  subtotalCents: number
  taxCents: number
  deliveryFeeCents: number
  totalCents: number
  drivingDistanceMeters: number
}

export async function fetchRestaurantsQuery(
  lat: number,
  lng: number,
  radiusKm = 25,
  signal?: AbortSignal
): Promise<RestaurantDto[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(radiusKm),
  })
  const res = await fetch(`${API_URL}/api/restaurants?${params.toString()}`, { signal })
  const data = (await res.json().catch(() => null)) as
    | { restaurants?: RestaurantDto[]; error?: string }
    | null
  if (!res.ok) {
    throw new Error(data?.error ?? 'Could not load restaurants')
  }
  return data?.restaurants ?? []
}

export async function fetchNearbyRestaurants(lat: number, lng: number): Promise<RestaurantDto[]> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  const res = await fetch(`${API_URL}/api/restaurants/nearby?${params.toString()}`)
  const data = (await res.json().catch(() => null)) as
    | { restaurants?: RestaurantDto[]; error?: string }
    | null
  if (!res.ok) {
    throw new Error(data?.error ?? 'Could not load nearby restaurants')
  }
  return data?.restaurants ?? []
}

export async function fetchRestaurantDetail(idOrSlug: string): Promise<RestaurantDetailDto> {
  const res = await fetch(`${API_URL}/api/restaurants/${encodeURIComponent(idOrSlug)}`)
  const data = (await res.json().catch(() => null)) as
    | { restaurant?: RestaurantDetailDto; error?: string }
    | null
  if (!res.ok) {
    throw new Error(data?.error ?? 'Could not load restaurant')
  }
  if (!data?.restaurant) {
    throw new Error('Restaurant not found')
  }
  return data.restaurant
}

export async function createCheckoutIntent(
  token: string,
  payload: {
    restaurantId: string
    items: Array<{ menuItemId: string; quantity: number }>
    deliveryAddress: {
      formattedAddress: string
      lat: number
      lng: number
      placeId: string | null
    }
  },
  signal?: AbortSignal,
): Promise<{ clientSecret: string; paymentIntentId: string; orderId: string; pendingOrderId: string; summary: CheckoutSummary }> {
  const res = await fetch(`${API_URL}/api/checkout/intent`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => null)) as
    | {
        clientSecret?: string
        paymentIntentId?: string
        orderId?: string
        pendingOrderId?: string
        summary?: CheckoutSummary
        error?: string
      }
    | null
  if (!res.ok) {
    throw new Error(data?.error ?? 'Could not initialize checkout')
  }
  if (!data?.clientSecret || !data.paymentIntentId || !data.orderId || !data.pendingOrderId || !data.summary) {
    throw new Error('Unexpected checkout response')
  }
  return {
    clientSecret: data.clientSecret,
    paymentIntentId: data.paymentIntentId,
    orderId: data.orderId,
    pendingOrderId: data.pendingOrderId,
    summary: data.summary,
  }
}


export async function markPaymentAttempted(token: string, pendingOrderId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/orders/pending/${encodeURIComponent(pendingOrderId)}/attempt`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? 'Failed to update payment status')
}

/** Frontend fallback: flags a pending order as failed when the webhook doesn't fire. */
export async function markPaymentFailed(token: string, pendingOrderId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/orders/pending/${encodeURIComponent(pendingOrderId)}/fail`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? 'Failed to mark payment as failed')
}

export type OrderDto = {
  id: string
  status: string
  restaurantId: string
  restaurantName: string | null
  restaurantLocation: { lat: number; lng: number } | null
  deliveryLocation: { lat: number; lng: number } | null
  subtotalCents: number
  taxCents: number
  deliveryFeeCents: number
  totalCents: number
  drivingDistanceMeters: number | null
  driverLocation: { lat: number; lng: number } | null
  ratingStars?: number | null
  ratedAt?: string | null
  updatedAt: string
}

export async function fetchOrder(token: string, orderId: string): Promise<OrderDto> {
  const res = await fetch(`${API_URL}/api/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json().catch(() => null)) as
    | { order?: OrderDto; error?: string }
    | null
  if (!res.ok) throw new Error(data?.error ?? 'Could not load order')
  if (!data?.order) throw new Error('Order not found')
  return data.order
}

export async function updateOrderStatus(
  token: string,
  orderId: string,
  status: 'Preparing' | 'Ready' | 'Out for Delivery' | 'Delivered',
): Promise<void> {
  const res = await fetch(`${API_URL}/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? 'Could not update order status')
}

export async function submitOrderRating(
  token: string,
  orderId: string,
  payload: { stars: number; comment?: string }
): Promise<void> {
  const res = await fetch(`${API_URL}/api/orders/${encodeURIComponent(orderId)}/rating`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? 'Could not submit rating')
}

export type OrderHistoryItem = {
  id: string
  status: string
  restaurantId: string
  isPendingPayment?: boolean
  paymentFailed?: boolean
  items: Array<{
    name: string
    quantity: number
    unitPriceCents: number
    menuItemId: string | null
  }>
  subtotalCents: number
  taxCents: number
  deliveryFeeCents: number
  totalCents: number
  createdAt: string
  updatedAt: string
}

export async function fetchOrderHistory(token: string): Promise<OrderHistoryItem[]> {
  const res = await fetch(`${API_URL}/api/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json().catch(() => null)) as
    | { orders?: OrderHistoryItem[]; error?: string }
    | null
  if (!res.ok) throw new Error(data?.error ?? 'Could not load order history')
  return data?.orders ?? []
}

export async function registerPushToken(
  token: string,
  payload: { token: string; platform?: string }
): Promise<void> {
  const res = await fetch(`${API_URL}/api/push/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? 'Could not register push token')
}

export type SearchResultItem = {
  menuItemId: string
  name: string
  description: string
  priceCents: number
  imageUrl: string | null
  restaurantId: string
  restaurantName: string
  restaurantRating: number
  restaurantRatingCount: number
  restaurantEtaMinutes: number
}

export async function searchMenuItems(
  query: string,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  const params = new URLSearchParams({ q: query })
  const res = await fetch(`${API_URL}/api/search?${params.toString()}`, { signal })
  const data = (await res.json().catch(() => null)) as
    | { results?: SearchResultItem[]; error?: string }
    | null
  if (!res.ok) throw new Error(data?.error ?? 'Search failed')
  return data?.results ?? []
}
