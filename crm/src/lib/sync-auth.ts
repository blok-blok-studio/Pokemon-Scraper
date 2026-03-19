import { NextRequest } from 'next/server'

export function validateSyncKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const key = authHeader.slice(7)
  const expected = process.env.SYNC_API_KEY
  if (!expected || key.length !== expected.length) return false
  // Constant-time comparison to prevent timing attacks
  let mismatch = 0
  for (let i = 0; i < key.length; i++) {
    mismatch |= key.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}
