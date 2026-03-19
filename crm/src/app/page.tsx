'use client'

import { formatCurrency, timeAgo, gradeColor, stageColor } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'
import Link from 'next/link'
import { AgentStatusPanel } from '@/components/agent-status'

interface DashboardData {
  totalDeals: number
  mustBuys: number
  pendingOutreach: number
  openTasks: number
  todaySpend: number
  recentDeals: {
    id: number
    cardName: string | null
    title: string
    source: string
    dealGrade: string | null
    price: number
    foundAt: string
  }[]
  recentOutreach: {
    id: number
    targetName: string
    contactMethod: string
    pipelineStage: string
    sentAt: string
    seller: { id: number; name: string } | null
  }[]
}

export default function Dashboard() {
  const { data, lastUpdated } = useLiveData<DashboardData>('/api/dashboard')

  const stats = data ? [
    { label: 'Total Deals', value: data.totalDeals, href: '/deals' },
    { label: 'Must-Buy', value: data.mustBuys, href: '/deals?grade=must-buy', color: 'text-green-400' },
    { label: 'Pending Outreach', value: data.pendingOutreach, href: '/outreach', color: 'text-yellow-400' },
    { label: 'Open Tasks', value: data.openTasks, href: '/tasks', color: 'text-blue-400' },
    { label: "Today's Spend", value: formatCurrency(data.todaySpend), href: '/spend' },
  ] : null

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats ? stats.map(s => (
          <Link key={s.label} href={s.href} className="bg-surface-secondary rounded-xl p-4 border border-gray-700 hover:border-brand/50 transition-colors">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color || 'text-white'}`}>{s.value}</p>
          </Link>
        )) : Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-surface-secondary rounded-xl p-4 border border-gray-700 animate-pulse">
            <div className="h-3 w-16 bg-gray-700 rounded mb-2" />
            <div className="h-7 w-12 bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      <AgentStatusPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Deals</h2>
            <Link href="/deals" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {(data?.recentDeals || []).map(d => (
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
            {data && data.recentDeals.length === 0 && <p className="text-sm text-gray-500">No deals synced yet</p>}
            {!data && <div className="text-gray-400 text-sm">Loading...</div>}
          </div>
        </div>

        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Outreach</h2>
            <Link href="/outreach" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {(data?.recentOutreach || []).map(o => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.targetName}</p>
                  <p className="text-xs text-gray-400">{o.contactMethod} &middot; {timeAgo(o.sentAt)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(o.pipelineStage)}`}>{o.pipelineStage}</span>
              </div>
            ))}
            {data && data.recentOutreach.length === 0 && <p className="text-sm text-gray-500">No outreach synced yet</p>}
            {!data && <div className="text-gray-400 text-sm">Loading...</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
