import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerPushToken } from '../lib/api'
import { registerFcmToken } from '../lib/firebase'
import { useAppStore } from '../store/useAppStore'

export default function ProfilePage() {
  const user = useAppStore((s) => s.user)
  const token = useAppStore((s) => s.token)
  const clearSession = useAppStore((s) => s.clearSession)
  const navigate = useNavigate()
  const [pushStatus, setPushStatus] = useState<string | null>(null)

  return (
    <div className="px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
      {user ? (
        <dl className="mt-6 max-w-md space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Name</dt>
            <dd className="text-slate-900">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="text-slate-900">{user.email}</dd>
          </div>
        </dl>
      ) : null}
      <button
        type="button"
        className="mt-8 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        onClick={() => {
          clearSession()
          navigate('/', { replace: true })
        }}
      >
        Sign out
      </button>

      <div className="mt-8 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enable push notifications for order status updates.
        </p>
        <button
          type="button"
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => {
            if (!token) return
            const authToken = token
            void (async () => {
              try {
                setPushStatus('Requesting permission…')
                const fcm = await registerFcmToken()
                if (!fcm) {
                  setPushStatus('FCM not supported or not configured')
                  return
                }
                await registerPushToken(authToken, { token: fcm, platform: 'web' })
                setPushStatus('Notifications enabled')
              } catch (e) {
                setPushStatus(e instanceof Error ? e.message : 'Failed to enable notifications')
              }
            })()
          }}
        >
          Enable push notifications
        </button>
        {pushStatus ? <p className="mt-2 text-xs text-slate-600">{pushStatus}</p> : null}
      </div>
    </div>
  )
}
