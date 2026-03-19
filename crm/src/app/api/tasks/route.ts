import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const completed = searchParams.get('completed')
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    const where: any = {}
    if (completed !== null) where.completed = completed === 'true'
    if (entityType) where.entityType = entityType
    if (entityId) {
      const parsed = parseInt(entityId)
      if (isNaN(parsed)) return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 })
      where.entityId = parsed
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }]
    })
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('GET /api/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, description, dueDate, entityType, entityId } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 })
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        entityType: entityType || null,
        entityId: entityId || null,
      }
    })
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('POST /api/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
