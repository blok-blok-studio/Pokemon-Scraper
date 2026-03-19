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
    if (numId === null) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await request.json()
    const data: any = {}

    if (body.status !== undefined) {
      data.status = body.status
      if (body.status === 'completed') {
        data.completedAt = new Date()
      } else {
        // Clear completedAt when reopening a task
        data.completedAt = null
      }
    }

    const task = await prisma.automationTask.update({
      where: { id: numId },
      data,
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('PATCH /api/automation-tasks/[id] error:', error)
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
    if (numId === null) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    await prisma.automationTask.delete({ where: { id: numId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/automation-tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
