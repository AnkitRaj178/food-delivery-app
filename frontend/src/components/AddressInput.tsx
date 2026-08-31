import { useEffect, useId, useRef, useState } from 'react'
import { postConfirmedAddress } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

type AddressInputProps = {
  onAddressCommitted?: () => void
  className?: string
}

export default function AddressInput({ onAddressCommitted, className }: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(onAddressCommitted)
  committedRef.current = onAddressCommitted
  const setDeliveryAddress = useAppStore((s) => s.setDeliveryAddress)
  const hintId = useId()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'searching' | 'busy' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [results, setResults] = useState<
    Array<{ placeId: string | null; formattedAddress: string; lat: number; lng: number }>
  >([])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setResults([])
      if (status !== 'busy') setStatus('idle')
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setStatus('searching')
          setMessage(null)
          const params = new URLSearchParams({
            q: trimmed,
            format: 'jsonv2',
            limit: '5',
            addressdetails: '1',
          })
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?${params.toString()}`,
            {
              signal: controller.signal,
              headers: {
                Accept: 'application/json',
              },
            }
          )
          if (!res.ok) throw new Error('Address search failed')
          const data = (await res.json()) as Array<{
            place_id?: number
            display_name?: string
            lat?: string
            lon?: string
          }>
          const mapped = data
            .map((entry) => ({
              placeId: entry.place_id != null ? String(entry.place_id) : null,
              formattedAddress: entry.display_name ?? '',
              lat: Number(entry.lat),
              lng: Number(entry.lon),
            }))
            .filter(
              (entry) =>
                entry.formattedAddress &&
                Number.isFinite(entry.lat) &&
                Number.isFinite(entry.lng)
            )
          setResults(mapped)
          setStatus('idle')
        } catch (e) {
          if (controller.signal.aborted) return
          setStatus('error')
          setMessage(e instanceof Error ? e.message : 'Could not search addresses')
        }
      })()
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [query, setDeliveryAddress])

  async function commitAddress(payload: {
    placeId: string | null
    formattedAddress: string
    lat: number
    lng: number
  }) {
    try {
      setStatus('busy')
      setMessage(null)
      await postConfirmedAddress(payload)
      setDeliveryAddress(payload)
      setResults([])
      setQuery(payload.formattedAddress)
      inputRef.current?.blur()
      committedRef.current?.()
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'Could not save address')
    }
  }

  return (
    <div className={className}>
      <label htmlFor={hintId} className="mb-1 block text-left text-sm font-medium text-slate-700">
        Delivery address
      </label>
      <input
        id={hintId}
        ref={inputRef}
        type="text"
        autoComplete="off"
        placeholder="Search your address"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setMessage(null)
        }}
        disabled={status === 'busy'}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none ring-orange-500/30 placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
      />
      <p className="mt-1 text-left text-xs text-slate-500">
        Powered by OpenStreetMap Nominatim. Pick a result to confirm your location.
      </p>
      {results.length > 0 ? (
        <ul className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white">
          {results.map((result) => (
            <li key={`${result.placeId ?? result.formattedAddress}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  void commitAddress(result)
                }}
              >
                {result.formattedAddress}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p
          className={`mt-2 text-left text-sm ${status === 'error' ? 'text-red-600' : 'text-slate-600'}`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
