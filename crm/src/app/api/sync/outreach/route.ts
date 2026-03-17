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

      await tx.outreachLog.upsert({
        where: { localId: r.local_id },
        update: {
          targetName: r.target_name,
          targetType: r.target_type,
          contactMethod: r.contact_method,
          contactInfo: r.contact_info,
          messageSent: r.message_sent || null,
          status: r.status || 'sent',
          updatedAt: r.updated_at ? new Date(r.updated_at) : null,
        },
        create: {
          localId: r.local_id,
          targetName: r.target_name,
          targetType: r.target_type,
          contactMethod: r.contact_method,
          contactInfo: r.contact_info,
          messageSent: r.message_sent || null,
          status: r.status || 'sent',
          sentAt: r.sent_at ? new Date(r.sent_at) : new Date(),
        }
      })
      synced++
    }

    await tx.syncCursor.upsert({
      where: { tableName: 'outreach_log' },
      update: { lastSyncedLocalId: maxLocalId, lastSyncedAt: new Date() },
      create: { tableName: 'outreach_log', lastSyncedLocalId: maxLocalId }
    })
  })

  return NextResponse.json({ synced, cursor: maxLocalId })
}
