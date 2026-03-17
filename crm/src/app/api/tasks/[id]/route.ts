import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const data: any = {}
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.completed !== undefined) data.completed = body.completed
  if (body.entityType !== undefined) data.entityType = body.entityType
  if (body.entityId !== undefined) data.entityId = body.entityId

  const task = await prisma.task.update({
    where: { id: parseInt(params.id) },
    data
  })
  return NextResponse.json(task)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.task.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ deleted: true })
}
