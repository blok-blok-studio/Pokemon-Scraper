import { NextRequest } from 'next/server'

export function validateSyncKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const key = authHeader.slice(7)
  return key === process.env.SYNC_API_KEY
}
