'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const DEFAULT_INTERVAL = 30000 // 30 seconds

interface UseLiveDataOptions {
  interval?: number
  enabled?: boolean
}

export function useLiveData<T>(
  url: string,
  options: UseLiveDataOptions = {}
): {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => void
} {
  const { interval = DEFAULT_INTERVAL, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const urlRef = useRef(url)
  urlRef.current = url

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(urlRef.current)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setError(null)
        setLastUpdated(new Date())
      } else {
        setError(`API error: ${res.status}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      // Keep stale data on refresh failures
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [url, fetchData])

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(fetchData, interval)
    return () => clearInterval(timer)
  }, [fetchData, interval, enabled])

  return { data, loading, error, lastUpdated, refresh: fetchData }
}

// Lightweight component to show live status
export function LiveIndicator({ lastUpdated }: { lastUpdated: Date | null }) {
  if (!lastUpdated) return null
  const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      {seconds < 5 ? 'Live' : `${seconds}s ago`}
    </span>
  )
}
