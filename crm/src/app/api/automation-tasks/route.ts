import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const taskType = searchParams.get('taskType')
    const priority = searchParams.get('priority')

    const where: any = {}
    if (status) where.status = status
    if (taskType) where.taskType = taskType
    if (priority) where.priority = priority

    const tasks = await prisma.automationTask.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 200,
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('GET /api/automation-tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
