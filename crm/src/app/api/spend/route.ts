import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [todaySpend, monthSpend, byService, dailyBreakdown, totalRecords] = await Promise.all([
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
    prisma.$queryRaw`
      SELECT
        DATE("calledAt") as date,
        service,
        SUM("estimatedCostUsd") as cost,
        COUNT(*) as calls
      FROM "ApiUsage"
      WHERE "calledAt" >= ${monthStart}
      GROUP BY DATE("calledAt"), service
      ORDER BY date DESC
    ` as Promise<any[]>,
    prisma.apiUsage.count()
  ])

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
}
