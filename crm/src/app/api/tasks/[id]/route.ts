import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function parseId(id: string): number | null {
  const parsed = parseInt(id)
  return isNaN(parsed) ? null : parsed
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseId(id)
    if (numId === null) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const body = await request.json()
    const data: any = {}
    if (body.title !== undefined) data.title = body.title
    if (body.description !== undefined) data.description = body.description
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.completed !== undefined) data.completed = body.completed
    if (body.entityType !== undefined) data.entityType = body.entityType
    if (body.entityId !== undefined) data.entityId = body.entityId

    const task = await prisma.task.update({
      where: { id: numId },
      data
    })
    return NextResponse.json(task)
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseId(id)
    if (numId === null) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    await prisma.task.delete({ where: { id: numId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
