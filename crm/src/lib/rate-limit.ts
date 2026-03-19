import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key)
  })
}, 5 * 60 * 1000)

export function rateLimit({
  maxRequests = 60,
  windowMs = 60 * 1000,
}: {
  maxRequests?: number
  windowMs?: number
} = {}) {
  return function check(identifier: string): NextResponse | null {
    const now = Date.now()
    const entry = store.get(identifier)

    if (!entry || now > entry.resetAt) {
      store.set(identifier, { count: 1, resetAt: now + windowMs })
      return null
    }

    entry.count++

    if (entry.count > maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
          },
        }
      )
    }

    return null
  }
}

// Pre-configured limiters
export const apiLimiter = rateLimit({ maxRequests: 60, windowMs: 60 * 1000 })
export const syncLimiter = rateLimit({ maxRequests: 30, windowMs: 60 * 1000 })
export const authLimiter = rateLimit({ maxRequests: 5, windowMs: 60 * 1000 })
