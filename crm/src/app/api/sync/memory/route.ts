import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSyncKey } from '@/lib/sync-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!validateSyncKey(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { records } = await request.json()
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 })
    }

    let synced = 0
    let maxLocalId = 0

    await prisma.$transaction(async (tx) => {
      for (const r of records) {
        if (r.local_id > maxLocalId) maxLocalId = r.local_id

        await tx.agentMemory.upsert({
          where: { localId: r.local_id },
          update: {
            category: r.category,
            content: r.content,
            context: r.context || null,
            importance: r.importance || 'normal',
            sourceEvent: r.source_event || null,
            timesRecalled: r.times_recalled || 0,
            lastRecalledAt: r.last_recalled_at ? new Date(r.last_recalled_at) : null,
            expiresAt: r.expires_at ? new Date(r.expires_at) : null,
          },
          create: {
            localId: r.local_id,
            category: r.category,
            content: r.content,
            context: r.context || null,
            importance: r.importance || 'normal',
            sourceEvent: r.source_event || null,
            timesRecalled: r.times_recalled || 0,
            lastRecalledAt: r.last_recalled_at ? new Date(r.last_recalled_at) : null,
            expiresAt: r.expires_at ? new Date(r.expires_at) : null,
            createdAt: r.created_at ? new Date(r.created_at) : new Date(),
          }
        })
        synced++
      }

      await tx.syncCursor.upsert({
        where: { tableName: 'agent_memory' },
        update: { lastSyncedLocalId: maxLocalId, lastSyncedAt: new Date() },
        create: { tableName: 'agent_memory', lastSyncedLocalId: maxLocalId }
      })
    })

    return NextResponse.json({ synced, cursor: maxLocalId })
  } catch (error) {
    console.error('POST /api/sync/memory error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
