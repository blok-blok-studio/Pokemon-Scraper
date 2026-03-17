import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSyncKey } from '@/lib/sync-auth'

export async function POST(request: NextRequest) {
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

      await tx.apiUsage.upsert({
        where: { localId: r.local_id },
        update: {
          service: r.service,
          endpoint: r.endpoint || null,
          tokensIn: r.tokens_in || null,
          tokensOut: r.tokens_out || null,
          estimatedCostUsd: r.estimated_cost_usd || null,
        },
        create: {
          localId: r.local_id,
          service: r.service,
          endpoint: r.endpoint || null,
          tokensIn: r.tokens_in || null,
          tokensOut: r.tokens_out || null,
          estimatedCostUsd: r.estimated_cost_usd || null,
          calledAt: r.called_at ? new Date(r.called_at) : new Date(),
        }
      })
      synced++
    }

    await tx.syncCursor.upsert({
      where: { tableName: 'api_usage' },
      update: { lastSyncedLocalId: maxLocalId, lastSyncedAt: new Date() },
      create: { tableName: 'api_usage', lastSyncedLocalId: maxLocalId }
    })
  })

  return NextResponse.json({ synced, cursor: maxLocalId })
}
