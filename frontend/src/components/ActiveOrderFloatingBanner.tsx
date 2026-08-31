import { io } from 'socket.io-client'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL, fetchOrderHistory, type OrderHistoryItem } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

type OrderUpdateEvent = {
  orderId: string
  status: string
  driverLocation: { lat: number; lng: number } | null
  updatedAt: string
}

export default function ActiveOrderFloatingBanner() {
  const token = useAppStore((s) => s.token)
  const navigate = useNavigate()
  const [activeOrder, setActiveOrder] = useState<OrderHistoryItem | null>(null)

  // ── 1. Poll order history to find an active (non-delivered) order ──────────
  useEffect(() => {
    if (!token) {
      setActiveOrder(null)
      return
    }

    let cancelled = false

    async function load() {
      if (!token) return
      try {
        const orders = await fetchOrderHistory(token)
        if (cancelled) return

        // Only show the banner for a real confirmed order that is not yet
        // delivered. Exclude pending-payment drafts and payment-failed orders —
        // those have their own UI in Order History and must never trigger the
        // green tracking banner.
        const active = orders.find(
          (o) =>
            !o.isPendingPayment &&
            !o.paymentFailed &&
            o.status?.toLowerCase() !== 'delivered'
        )
        setActiveOrder(active ?? null)
      } catch (e) {
        console.error('Failed to load orders for banner', e)
      }
    }

    void load()

    // Keep a slow poll as a fallback (e.g. new order placed in another tab)
    const interval = setInterval(() => {
      void load()
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [token])

  // ── 2. Real-time Socket.io listener scoped to the active order's room ──────
  useEffect(() => {
    if (!activeOrder?.id) return

    const socket = io(API_URL, { transports: ['websocket'] })

    // Join the same room that OrderStatusPage uses
    socket.emit('join_room', activeOrder.id)

    socket.on('order_updated', (payload: OrderUpdateEvent) => {
      if (payload.orderId !== activeOrder.id) return

      setActiveOrder((prev) => {
        if (!prev) return prev
        // When delivered, clear the banner so it disappears instantly
        if (payload.status?.toLowerCase() === 'delivered') return null
        return { ...prev, status: payload.status, updatedAt: payload.updatedAt }
      })
    })

    return () => {
      socket.off('order_updated')
      socket.disconnect()
    }
  }, [activeOrder?.id])

  if (!activeOrder) return null

  return (
    <button
      type="button"
      onClick={() => navigate(`/order/${activeOrder.id}`)}
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg bg-green-600 text-white px-6 py-3 font-semibold hover:bg-green-700 transition animate-bounce hover:animate-none flex items-center gap-2"
    >
      🚗 {activeOrder.status} - Track Status
    </button>
  )
}
