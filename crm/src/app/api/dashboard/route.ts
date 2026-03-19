import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

    const [
      totalDeals,
      mustBuys,
      pendingOutreach,
      openTasks,
      pendingAutoTasks,
      recentDeals,
      recentOutreach,
      todaySpendResult,
    ] = await Promise.all([
      prisma.cardListing.count(),
      prisma.cardListing.count({ where: { dealGrade: 'must-buy' } }),
      prisma.outreachLog.count({ where: { pipelineStage: 'pending' } }),
      prisma.task.count({ where: { completed: false } }),
      prisma.automationTask.count({ where: { status: 'pending' } }),
      prisma.cardListing.findMany({ orderBy: { foundAt: 'desc' }, take: 8 }),
      prisma.outreachLog.findMany({ orderBy: { sentAt: 'desc' }, take: 5, include: { seller: true } }),
      prisma.apiUsage.aggregate({
        where: { calledAt: { gte: todayStart } },
        _sum: { estimatedCostUsd: true }
      }),
    ])

    return NextResponse.json({
      totalDeals,
      mustBuys,
      pendingOutreach,
      openTasks: openTasks + pendingAutoTasks,
      todaySpend: todaySpendResult._sum.estimatedCostUsd || 0,
      recentDeals,
      recentOutreach,
    })
  } catch (error) {
    console.error('GET /api/dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
