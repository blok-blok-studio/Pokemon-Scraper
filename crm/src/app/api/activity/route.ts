import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface ActivityEvent {
  id: string
  type: 'scrape' | 'analysis' | 'outreach' | 'sync' | 'task' | 'alert' | 'price_check'
  title: string
  detail: string | null
  timestamp: string
  metadata?: Record<string, any>
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const type = searchParams.get('type')
    const since = searchParams.get('since')

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Always fetch counts for stats (regardless of type filter)
    const [scrapeCount, analysisCount, outreachCount, taskCount, apiUsageAgg] = await Promise.all([
      prisma.cardListing.count({ where: { foundAt: { gte: sinceDate } } }),
      prisma.cardListing.count({ where: { dealGrade: { not: null }, foundAt: { gte: sinceDate } } }),
      prisma.outreachLog.count({ where: { sentAt: { gte: sinceDate } } }),
      prisma.automationTask.count({ where: { createdAt: { gte: sinceDate } } }),
      prisma.apiUsage.aggregate({
        where: { calledAt: { gte: sinceDate } },
        _sum: { estimatedCostUsd: true },
        _count: true,
      }),
    ])

    const stats = {
      totalEvents: scrapeCount + analysisCount + outreachCount + taskCount + (apiUsageAgg._count || 0),
      scrapes: scrapeCount,
      analyses: analysisCount,
      outreach: outreachCount,
      tasks: taskCount,
      apiCalls: apiUsageAgg._count || 0,
      totalSpend: apiUsageAgg._sum.estimatedCostUsd || 0,
    }

    // Now fetch events for the timeline (filtered by type if set)
    const events: ActivityEvent[] = []

    // 1. Scrape events
    if (!type || type === 'scrape') {
      const listings = await prisma.cardListing.findMany({
        where: { foundAt: { gte: sinceDate } },
        orderBy: { foundAt: 'desc' },
        take: limit,
        select: { id: true, cardName: true, title: true, source: true, price: true, dealGrade: true, foundAt: true }
      })
      listings.forEach(l => {
        events.push({
          id: `scrape-${l.id}`,
          type: 'scrape',
          title: `Found: ${l.cardName || l.title}`,
          detail: `${l.source} — $${l.price}`,
          timestamp: l.foundAt.toISOString(),
          metadata: { source: l.source, price: l.price, grade: l.dealGrade }
        })
      })
    }

    // 2. Analysis events
    if (!type || type === 'analysis') {
      const analyzed = await prisma.cardListing.findMany({
        where: { dealGrade: { not: null }, foundAt: { gte: sinceDate } },
        orderBy: { foundAt: 'desc' },
        take: limit,
        select: { id: true, cardName: true, title: true, dealGrade: true, aiSummary: true, discountPercent: true, foundAt: true }
      })
      analyzed.forEach(a => {
        events.push({
          id: `analysis-${a.id}`,
          type: 'analysis',
          title: `Graded: ${a.cardName || a.title}`,
          detail: `${a.dealGrade}${a.discountPercent ? ` (${Math.round(a.discountPercent)}% discount)` : ''} — ${a.aiSummary || 'No summary'}`,
          timestamp: a.foundAt.toISOString(),
          metadata: { grade: a.dealGrade, discount: a.discountPercent }
        })
      })
    }

    // 3. Outreach events
    if (!type || type === 'outreach') {
      const outreach = await prisma.outreachLog.findMany({
        where: { sentAt: { gte: sinceDate } },
        orderBy: { sentAt: 'desc' },
        take: limit,
        select: { id: true, targetName: true, contactMethod: true, status: true, subject: true, sentAt: true }
      })
      outreach.forEach(o => {
        events.push({
          id: `outreach-${o.id}`,
          type: 'outreach',
          title: `${o.contactMethod === 'email' ? '📧' : '📞'} ${o.contactMethod} to ${o.targetName}`,
          detail: o.subject || o.status || null,
          timestamp: o.sentAt.toISOString(),
          metadata: { method: o.contactMethod, status: o.status }
        })
      })
    }

    // 4. Automation tasks
    if (!type || type === 'task') {
      const tasks = await prisma.automationTask.findMany({
        where: { createdAt: { gte: sinceDate } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, taskType: true, description: true, status: true, priority: true, createdAt: true, completedAt: true }
      })
      tasks.forEach(t => {
        events.push({
          id: `task-${t.id}`,
          type: 'task',
          title: `Task: ${t.taskType}`,
          detail: `${t.description || ''} [${t.status}${t.priority === 'high' ? ' — HIGH' : ''}]`,
          timestamp: t.createdAt.toISOString(),
          metadata: { status: t.status, priority: t.priority }
        })
      })
    }

    // 5. API usage
    if (!type || type === 'sync') {
      const usage = await prisma.apiUsage.findMany({
        where: { calledAt: { gte: sinceDate } },
        orderBy: { calledAt: 'desc' },
        take: 100,
        select: { id: true, service: true, endpoint: true, tokensIn: true, tokensOut: true, estimatedCostUsd: true, calledAt: true }
      })
      usage.forEach(u => {
        events.push({
          id: `api-${u.id}`,
          type: 'sync',
          title: `API: ${u.service} — ${u.endpoint || 'unknown'}`,
          detail: `${(u.tokensIn || 0) + (u.tokensOut || 0)} tokens, $${(u.estimatedCostUsd || 0).toFixed(4)}`,
          timestamp: u.calledAt.toISOString(),
          metadata: { service: u.service, cost: u.estimatedCostUsd }
        })
      })
    }

    // Sort all events by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ events: events.slice(0, limit), stats })
  } catch (error) {
    console.error('GET /api/activity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
