import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const CART_STORAGE_KEY = 'food-delivery-cart'

export type CartItem = {
  menuItemId: string
  name: string
  unitPriceCents: number
  quantity: number
  imageUrl: string | null
}

type CartRestaurant = {
  restaurantId: string
  restaurantName: string
}

type PendingReplacement = {
  restaurantId: string
  restaurantName: string
  item: CartItem
}

type CartState = {
  restaurant: CartRestaurant | null
  items: CartItem[]
  pendingReplacement: PendingReplacement | null
  addItem: (
    restaurant: CartRestaurant,
    item: Omit<CartItem, 'quantity'>,
    quantity?: number
  ) => { ok: boolean; requiresConfirmation: boolean }
  confirmReplaceCart: () => void
  cancelPendingReplacement: () => void
  incrementItem: (menuItemId: string) => void
  decrementItem: (menuItemId: string) => void
  removeItem: (menuItemId: string) => void
  clearCart: () => void
  setCart: (restaurant: CartRestaurant, items: CartItem[]) => void
}

function mergeItem(items: CartItem[], nextItem: CartItem) {
  const existing = items.find((item) => item.menuItemId === nextItem.menuItemId)
  if (!existing) return [...items, nextItem]
  return items.map((item) =>
    item.menuItemId === nextItem.menuItemId
      ? { ...item, quantity: item.quantity + nextItem.quantity }
      : item
  )
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      restaurant: null,
      items: [],
      pendingReplacement: null,
      addItem: (restaurant, item, quantity = 1) => {
        let result = { ok: true, requiresConfirmation: false }
        set((state) => {
          const nextItem: CartItem = { ...item, quantity }

          if (
            state.restaurant &&
            state.restaurant.restaurantId !== restaurant.restaurantId &&
            state.items.length > 0
          ) {
            result = { ok: false, requiresConfirmation: true }
            return {
              pendingReplacement: {
                restaurantId: restaurant.restaurantId,
                restaurantName: restaurant.restaurantName,
                item: nextItem,
              },
            }
          }

          return {
            restaurant,
            items: mergeItem(state.items, nextItem),
            pendingReplacement: null,
          }
        })
        return result
      },
      confirmReplaceCart: () =>
        set((state) => {
          if (!state.pendingReplacement) return state
          const pending = state.pendingReplacement
          return {
            restaurant: {
              restaurantId: pending.restaurantId,
              restaurantName: pending.restaurantName,
            },
            items: [pending.item],
            pendingReplacement: null,
          }
        }),
      cancelPendingReplacement: () => set({ pendingReplacement: null }),
      incrementItem: (menuItemId) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + 1 } : item
          ),
        })),
      decrementItem: (menuItemId) =>
        set((state) => {
          const items = state.items
            .map((item) =>
              item.menuItemId === menuItemId ? { ...item, quantity: item.quantity - 1 } : item
            )
            .filter((item) => item.quantity > 0)
          return {
            items,
            restaurant: items.length === 0 ? null : state.restaurant,
          }
        }),
      removeItem: (menuItemId) =>
        set((state) => {
          const items = state.items.filter((item) => item.menuItemId !== menuItemId)
          return {
            items,
            restaurant: items.length === 0 ? null : state.restaurant,
          }
        }),
      clearCart: () => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(CART_STORAGE_KEY)
          }
        } catch {
          // ignore storage failures (private mode, quota, etc.)
        }

        set({ restaurant: null, items: [], pendingReplacement: null })
      },
      setCart: (restaurant, items) => set({ restaurant, items, pendingReplacement: null }),
    }),
    {
      name: CART_STORAGE_KEY,
      partialize: (state) => ({
        restaurant: state.restaurant,
        items: state.items,
      }),
    }
  )
)
