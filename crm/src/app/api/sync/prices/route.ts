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

      await tx.priceHistory.upsert({
        where: { localId: r.local_id },
        update: { cardName: r.card_name, setName: r.set_name || null, source: r.source, price: r.price },
        create: {
          localId: r.local_id,
          cardName: r.card_name,
          setName: r.set_name || null,
          source: r.source,
          price: r.price,
          recordedAt: r.recorded_at ? new Date(r.recorded_at) : new Date(),
        }
      })
      synced++
    }

    await tx.syncCursor.upsert({
      where: { tableName: 'price_history' },
      update: { lastSyncedLocalId: maxLocalId, lastSyncedAt: new Date() },
      create: { tableName: 'price_history', lastSyncedLocalId: maxLocalId }
    })
  })

  return NextResponse.json({ synced, cursor: maxLocalId })
}
