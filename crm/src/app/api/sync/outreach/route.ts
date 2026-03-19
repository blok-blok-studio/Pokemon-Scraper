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
    if (records.length > 500) {
      return NextResponse.json({ error: 'Batch too large (max 500)' }, { status: 400 })
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
            subject: r.subject || null,
            messageSent: r.message_sent || null,
            status: r.status || 'sent',
            pipelineStage: r.pipeline_stage || undefined,
            approved: r.approved !== undefined ? Boolean(r.approved) : undefined,
            updatedAt: r.updated_at ? new Date(r.updated_at) : null,
          },
          create: {
            localId: r.local_id,
            targetName: r.target_name,
            targetType: r.target_type,
            contactMethod: r.contact_method,
            contactInfo: r.contact_info,
            subject: r.subject || null,
            messageSent: r.message_sent || null,
            status: r.status || 'sent',
            pipelineStage: r.pipeline_stage || 'pending',
            approved: r.approved ? Boolean(r.approved) : false,
            sentAt: r.sent_at ? new Date(r.sent_at) : new Date(),
          }
        })
        synced++

        // Link outreach to seller — create if they don't exist
        if (r.target_name) {
          const seller = await tx.seller.upsert({
            where: { name: r.target_name },
            update: {},
            create: { name: r.target_name, type: r.target_type || null }
          })

          await tx.outreachLog.updateMany({
            where: { localId: r.local_id },
            data: { sellerId: seller.id }
          })
        }
      }

      await tx.syncCursor.upsert({
        where: { tableName: 'outreach_log' },
        update: { lastSyncedLocalId: maxLocalId, lastSyncedAt: new Date() },
        create: { tableName: 'outreach_log', lastSyncedLocalId: maxLocalId }
      })
    })

    return NextResponse.json({ synced, cursor: maxLocalId })
  } catch (error) {
    console.error('POST /api/sync/outreach error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
