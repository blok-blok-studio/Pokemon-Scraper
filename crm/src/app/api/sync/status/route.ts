import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSyncKey } from '@/lib/sync-auth'

export async function GET(request: NextRequest) {
  if (!validateSyncKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cursors = await prisma.syncCursor.findMany()
  const result: Record<string, number> = {}
  for (const c of cursors) {
    result[c.tableName] = c.lastSyncedLocalId
  }

  return NextResponse.json(result)
}
