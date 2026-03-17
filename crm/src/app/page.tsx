import { prisma } from '@/lib/prisma'
import { formatCurrency, timeAgo, gradeColor, stageColor } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const [
    totalDeals,
    mustBuys,
    pendingOutreach,
    openTasks,
    recentDeals,
    recentOutreach,
    todaySpendResult,
  ] = await Promise.all([
    prisma.cardListing.count(),
    prisma.cardListing.count({ where: { dealGrade: 'must-buy' } }),
    prisma.outreachLog.count({ where: { pipelineStage: 'pending' } }),
    prisma.task.count({ where: { completed: false } }),
    prisma.cardListing.findMany({ orderBy: { foundAt: 'desc' }, take: 8 }),
    prisma.outreachLog.findMany({ orderBy: { sentAt: 'desc' }, take: 5, include: { seller: true } }),
    prisma.apiUsage.aggregate({
      where: { calledAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      _sum: { estimatedCostUsd: true }
    }),
  ])

  const todaySpend = todaySpendResult._sum.estimatedCostUsd || 0

  const stats = [
    { label: 'Total Deals', value: totalDeals, href: '/deals' },
    { label: 'Must-Buy', value: mustBuys, href: '/deals?grade=must-buy', color: 'text-green-400' },
    { label: 'Pending Outreach', value: pendingOutreach, href: '/outreach', color: 'text-yellow-400' },
    { label: 'Open Tasks', value: openTasks, href: '/tasks', color: 'text-blue-400' },
    { label: "Today's Spend", value: formatCurrency(todaySpend), href: '/spend' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="bg-surface-secondary rounded-xl p-4 border border-gray-700 hover:border-brand/50 transition-colors">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color || 'text-white'}`}>{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Deals</h2>
            <Link href="/deals" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentDeals.map(d => (
              <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0 hover:bg-gray-700/20 -mx-2 px-2 rounded">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.cardName || d.title}</p>
                  <p className="text-xs text-gray-400">{d.source} &middot; {timeAgo(d.foundAt)}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${gradeColor(d.dealGrade)}`}>{d.dealGrade || 'ungraded'}</span>
                  <span className="text-sm font-medium">{formatCurrency(d.price)}</span>
                </div>
              </Link>
            ))}
            {recentDeals.length === 0 && <p className="text-sm text-gray-500">No deals synced yet</p>}
          </div>
        </div>

        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Outreach</h2>
            <Link href="/outreach" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentOutreach.map(o => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.targetName}</p>
                  <p className="text-xs text-gray-400">{o.contactMethod} &middot; {timeAgo(o.sentAt)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(o.pipelineStage)}`}>{o.pipelineStage}</span>
              </div>
            ))}
            {recentOutreach.length === 0 && <p className="text-sm text-gray-500">No outreach synced yet</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
