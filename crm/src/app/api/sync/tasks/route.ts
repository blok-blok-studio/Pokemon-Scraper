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

        await tx.automationTask.upsert({
          where: { localId: r.local_id },
          update: {
            taskType: r.task_type,
            entityType: r.entity_type || null,
            entityId: r.entity_id || null,
            title: r.title,
            description: r.description || null,
            status: r.status || 'pending',
            priority: r.priority || 'normal',
            dueDate: r.due_date ? new Date(r.due_date) : null,
            completedAt: r.completed_at ? new Date(r.completed_at) : null,
          },
          create: {
            localId: r.local_id,
            taskType: r.task_type,
            entityType: r.entity_type || null,
            entityId: r.entity_id || null,
            title: r.title,
            description: r.description || null,
            status: r.status || 'pending',
            priority: r.priority || 'normal',
            dueDate: r.due_date ? new Date(r.due_date) : null,
            createdAt: r.created_at ? new Date(r.created_at) : new Date(),
            completedAt: r.completed_at ? new Date(r.completed_at) : null,
          }
        })
        synced++
      }

      await tx.syncCursor.upsert({
        where: { tableName: 'automation_tasks' },
        update: { lastSyncedLocalId: maxLocalId, lastSyncedAt: new Date() },
        create: { tableName: 'automation_tasks', lastSyncedLocalId: maxLocalId }
      })
    })

    return NextResponse.json({ synced, cursor: maxLocalId })
  } catch (error) {
    console.error('POST /api/sync/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
