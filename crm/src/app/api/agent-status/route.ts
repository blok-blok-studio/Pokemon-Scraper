import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const todayStart = new Date(now.setHours(0, 0, 0, 0))
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      syncCursors,
      todayListings,
      todayOutreach,
      todayAnalyzed,
      todayApiCalls,
      pendingAutoTasks,
      highPriorityTasks,
      recentActivity,
    ] = await Promise.all([
      // Sync health
      prisma.syncCursor.findMany(),

      // Today's agent activity counts
      prisma.cardListing.count({ where: { foundAt: { gte: todayStart } } }),
      prisma.outreachLog.count({ where: { sentAt: { gte: todayStart } } }),
      prisma.cardListing.count({ where: { foundAt: { gte: todayStart }, dealGrade: { not: null } } }),
      prisma.apiUsage.count({ where: { calledAt: { gte: todayStart } } }),

      // Automation tasks
      prisma.automationTask.count({ where: { status: 'pending' } }),
      prisma.automationTask.count({ where: { status: 'pending', priority: 'high' } }),

      // Recent activity feed — last 20 events across tables
      buildActivityFeed(last24h),
    ])

    // Calculate sync health
    const syncHealth = syncCursors.map(c => ({
      table: c.tableName,
      lastSyncedId: c.lastSyncedLocalId,
      lastSyncedAt: c.lastSyncedAt,
      minutesAgo: Math.round((Date.now() - c.lastSyncedAt.getTime()) / 60000),
    }))

    const lastSyncTime = syncCursors.length > 0
      ? new Date(Math.max(...syncCursors.map(c => c.lastSyncedAt.getTime())))
      : null

    const syncOk = lastSyncTime && (Date.now() - lastSyncTime.getTime()) < 15 * 60 * 1000

    return NextResponse.json({
      sync: {
        healthy: syncOk,
        lastSync: lastSyncTime,
        tables: syncHealth,
      },
      today: {
        listingsScraped: todayListings,
        outreachSent: todayOutreach,
        dealsAnalyzed: todayAnalyzed,
        apiCalls: todayApiCalls,
      },
      automation: {
        pendingTasks: pendingAutoTasks,
        highPriority: highPriorityTasks,
      },
      activity: recentActivity,
    })
  } catch (error) {
    console.error('GET /api/agent-status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function buildActivityFeed(since: Date) {
  const [deals, outreach, tasks] = await Promise.all([
    prisma.cardListing.findMany({
      where: { foundAt: { gte: since } },
      orderBy: { foundAt: 'desc' },
      take: 10,
      select: { id: true, cardName: true, dealGrade: true, price: true, discountPercent: true, source: true, foundAt: true },
    }),
    prisma.outreachLog.findMany({
      where: { sentAt: { gte: since } },
      orderBy: { sentAt: 'desc' },
      take: 10,
      select: { id: true, targetName: true, contactMethod: true, status: true, sentAt: true },
    }),
    prisma.automationTask.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, title: true, taskType: true, priority: true, createdAt: true },
    }),
  ])

  const feed = [
    ...deals.map(d => ({
      type: 'deal' as const,
      time: d.foundAt,
      text: `Found ${d.cardName}`,
      detail: d.dealGrade ? `${d.dealGrade} — $${d.price}${d.discountPercent ? ` (${Math.round(d.discountPercent)}% off)` : ''}` : `$${d.price}`,
      grade: d.dealGrade,
    })),
    ...outreach.map(o => ({
      type: 'outreach' as const,
      time: o.sentAt,
      text: `${o.contactMethod === 'voice' ? 'Called' : 'Emailed'} ${o.targetName}`,
      detail: o.status,
      grade: null,
    })),
    ...tasks.map(t => ({
      type: 'task' as const,
      time: t.createdAt,
      text: t.title,
      detail: `${t.taskType} — ${t.priority}`,
      grade: null,
    })),
  ]

  feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  return feed.slice(0, 20)
}
