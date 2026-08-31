import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '../lib/api'

export type DeliveryAddress = {
  formattedAddress: string
  lat: number
  lng: number
  placeId: string | null
}

type AppState = {
  deliveryAddress: DeliveryAddress | null
  token: string | null
  user: AuthUser | null
  setDeliveryAddress: (address: DeliveryAddress | null) => void
  setSession: (token: string, user: AuthUser) => void
  clearSession: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      deliveryAddress: null,
      token: null,
      user: null,
      setDeliveryAddress: (deliveryAddress) => set({ deliveryAddress }),
      setSession: (token, user) => set({ token, user }),
      clearSession: () => set({ token: null, user: null }),
    }),
    {
      name: 'food-delivery-app',
      partialize: (state) => ({
        deliveryAddress: state.deliveryAddress,
        token: state.token,
        user: state.user,
      }),
    }
  )
)
