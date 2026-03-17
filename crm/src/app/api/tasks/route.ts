import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const completed = searchParams.get('completed')
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  const where: any = {}
  if (completed !== null) where.completed = completed === 'true'
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = parseInt(entityId)

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }]
  })
  return NextResponse.json(tasks)
}

export async function POST(request: NextRequest) {
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
}
