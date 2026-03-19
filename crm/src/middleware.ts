import { NextRequest, NextResponse } from 'next/server'

// In-memory rate limit store for Edge runtime
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Periodically clean up expired entries to prevent memory leak
function cleanupRateLimitStore() {
  const now = Date.now()
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
    }
  })
}

// Run cleanup every 5 minutes
let lastCleanup = Date.now()
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): NextResponse | null {
  const now = Date.now()

  // Periodic cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now
    cleanupRateLimitStore()
  }

  const entry = rateLimitStore.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs })
    return null
  }

  entry.count++

  if (entry.count > maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) },
      }
    )
  }

  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // Skip static files
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  // Rate limit auth attempts (strict: 5 per minute)
  if (pathname.startsWith('/api/auth')) {
    const blocked = checkRateLimit(`auth:${ip}`, 5, 60 * 1000)
    if (blocked) return blocked
    return NextResponse.next()
  }

  // Rate limit sync endpoints (30 per minute)
  if (pathname.startsWith('/api/sync')) {
    const blocked = checkRateLimit(`sync:${ip}`, 30, 60 * 1000)
    if (blocked) return blocked
    return NextResponse.next()
  }

  // Skip login page
  if (pathname === '/login') {
    return NextResponse.next()
  }

  // Rate limit general API (60 per minute)
  if (pathname.startsWith('/api/')) {
    const blocked = checkRateLimit(`api:${ip}`, 60, 60 * 1000)
    if (blocked) return blocked
  }

  // Check session cookie for non-API routes and non-excluded paths
  if (!pathname.startsWith('/api/sync') && !pathname.startsWith('/api/auth')) {
    const session = request.cookies.get('crm_session')
    if (session?.value !== 'authenticated') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
