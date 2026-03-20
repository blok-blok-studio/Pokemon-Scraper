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

export async function POST(request: NextRequest) {
  try {
    if (!validateSyncKey(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reset } = await request.json()
    if (!reset) {
      return NextResponse.json({ error: 'Provide table name in "reset" field' }, { status: 400 })
    }

    await prisma.syncCursor.updateMany({
      where: { tableName: reset },
      data: { lastSyncedLocalId: 0, lastSyncedAt: new Date() }
    })

    return NextResponse.json({ reset: true, table: reset })
  } catch (error) {
    console.error('POST /api/sync/status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
