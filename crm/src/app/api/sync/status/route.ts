import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSyncKey } from '@/lib/sync-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!validateSyncKey(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cursors = await prisma.syncCursor.findMany()
    const result: Record<string, number> = {}
    for (const c of cursors) {
      result[c.tableName] = c.lastSyncedLocalId
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/sync/status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
