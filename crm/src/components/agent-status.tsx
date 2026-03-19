'use client'

import { useState } from 'react'
import { useLiveData } from '@/hooks/use-live-data'

interface SyncTable {
  table: string
  lastSyncedId: number
  lastSyncedAt: string
  minutesAgo: number
}

interface ActivityItem {
  type: 'deal' | 'outreach' | 'task'
  time: string
  text: string
  detail: string
  grade: string | null
}

interface AgentStatus {
  sync: {
    healthy: boolean
    lastSync: string | null
    tables: SyncTable[]
  }
  today: {
    listingsScraped: number
    outreachSent: number
    dealsAnalyzed: number
    apiCalls: number
  }
  automation: {
    pendingTasks: number
    highPriority: number
  }
  activity: ActivityItem[]
}

const typeIcon: Record<string, string> = {
  deal: '🃏',
  outreach: '📬',
  task: '📋',
}

const gradeStyle: Record<string, string> = {
  'must-buy': 'text-green-400',
  'good-deal': 'text-green-300',
  'fair': 'text-yellow-300',
  'overpriced': 'text-red-300',
  'suspicious': 'text-red-400',
}

function timeAgoShort(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function AgentStatusPanel() {
  const { data: status } = useLiveData<AgentStatus>('/api/agent-status', { interval: 60000 })
  const [showSync, setShowSync] = useState(false)

  if (!status) {
    return (
      <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-48 mb-4"></div>
        <div className="h-20 bg-gray-700/50 rounded"></div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Agent Stats + Sync Health */}
      <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Agent Status</h2>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.sync.healthy ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></span>
            <span className="text-xs text-gray-400">
              {status.sync.healthy ? 'Syncing' : 'Sync stale'}
            </span>
          </div>
        </div>

        {/* Today's numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-400">Scraped Today</p>
            <p className="text-lg font-bold">{status.today.listingsScraped}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-400">Analyzed</p>
            <p className="text-lg font-bold">{status.today.dealsAnalyzed}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-400">Outreach</p>
            <p className="text-lg font-bold">{status.today.outreachSent}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-400">API Calls</p>
            <p className="text-lg font-bold">{status.today.apiCalls}</p>
          </div>
        </div>

        {/* Automation tasks summary */}
        {status.automation.pendingTasks > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-blue-400">
              {status.automation.pendingTasks} pending task{status.automation.pendingTasks !== 1 ? 's' : ''}
              {status.automation.highPriority > 0 && (
                <span className="text-red-400 ml-1">({status.automation.highPriority} high priority)</span>
              )}
            </p>
          </div>
        )}

        {/* Sync details toggle */}
        <button
          onClick={() => setShowSync(!showSync)}
          className="text-xs text-gray-500 hover:text-gray-300 w-full text-left"
        >
          {showSync ? '▼' : '▶'} Sync Details
        </button>

        {showSync && (
          <div className="space-y-2">
            {status.sync.tables.map(t => (
              <div key={t.table} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-mono">{t.table}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">#{t.lastSyncedId}</span>
                  <span className={t.minutesAgo > 15 ? 'text-red-400' : t.minutesAgo > 10 ? 'text-yellow-400' : 'text-green-400'}>
                    {t.minutesAgo}m ago
                  </span>
                </div>
              </div>
            ))}
            {status.sync.tables.length === 0 && (
              <p className="text-xs text-gray-500">No sync data yet</p>
            )}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div className="lg:col-span-2 bg-surface-secondary rounded-xl border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Agent Activity (24h)</h2>
          <span className="text-xs text-gray-500">{status.activity.length} events</span>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {status.activity.map((item, i) => (
            <div key={i} className="flex items-start gap-3 py-1.5 border-b border-gray-700/30 last:border-0">
              <span className="text-sm flex-shrink-0 mt-0.5">{typeIcon[item.type] || '•'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.text}</p>
                <p className={`text-xs ${item.grade ? gradeStyle[item.grade] || 'text-gray-400' : 'text-gray-500'}`}>
                  {item.detail}
                </p>
              </div>
              <span className="text-xs text-gray-600 flex-shrink-0">{timeAgoShort(item.time)}</span>
            </div>
          ))}
          {status.activity.length === 0 && (
            <p className="text-gray-500 text-center py-6 text-sm">No agent activity in the last 24 hours</p>
          )}
        </div>
      </div>
    </div>
  )
}
