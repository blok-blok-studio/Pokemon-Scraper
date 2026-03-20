import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [todaySpend, monthSpend, byService, totalRecords] = await Promise.all([
      prisma.apiUsage.aggregate({
        where: { calledAt: { gte: todayStart } },
        _sum: { estimatedCostUsd: true }
      }),
      prisma.apiUsage.aggregate({
        where: { calledAt: { gte: monthStart } },
        _sum: { estimatedCostUsd: true }
      }),
      prisma.apiUsage.groupBy({
        by: ['service'],
        _sum: { estimatedCostUsd: true, tokensIn: true, tokensOut: true },
        _count: true,
        orderBy: { _sum: { estimatedCostUsd: 'desc' } }
      }),
      prisma.apiUsage.count()
    ])

    // Build daily breakdown from individual records (avoids raw SQL issues)
    const recentRecords = await prisma.apiUsage.findMany({
      where: { calledAt: { gte: monthStart } },
      select: { service: true, estimatedCostUsd: true, calledAt: true },
      orderBy: { calledAt: 'desc' }
    })

    const dailyMap: Record<string, { date: string; service: string; cost: number; calls: number }> = {}
    recentRecords.forEach(r => {
      const dateStr = r.calledAt.toISOString().split('T')[0]
      const key = `${dateStr}-${r.service}`
      if (!dailyMap[key]) {
        dailyMap[key] = { date: dateStr, service: r.service, cost: 0, calls: 0 }
      }
      dailyMap[key].cost += r.estimatedCostUsd || 0
      dailyMap[key].calls += 1
    })
    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json({
      today: todaySpend._sum.estimatedCostUsd || 0,
      month: monthSpend._sum.estimatedCostUsd || 0,
      byService: byService.map(s => ({
        service: s.service,
        cost: s._sum.estimatedCostUsd || 0,
        tokensIn: s._sum.tokensIn || 0,
        tokensOut: s._sum.tokensOut || 0,
        calls: s._count
      })),
      dailyBreakdown,
      totalRecords
    })
  } catch (error) {
    console.error('GET /api/spend error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
