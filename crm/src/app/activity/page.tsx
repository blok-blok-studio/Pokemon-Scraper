'use client'

import { useState, useMemo } from 'react'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'

interface ActivityEvent {
  id: string
  type: 'scrape' | 'analysis' | 'outreach' | 'sync' | 'task' | 'alert' | 'price_check'
  title: string
  detail: string | null
  timestamp: string
  metadata?: Record<string, any>
}

interface ActivityData {
  events: ActivityEvent[]
  stats: {
    totalEvents: number
    scrapes: number
    analyses: number
    outreach: number
    tasks: number
    apiCalls: number
    totalSpend: number
  }
}

const eventTypes = [
  { key: '', label: 'All', icon: '📋' },
  { key: 'scrape', label: 'Scrapes', icon: '🔍' },
  { key: 'analysis', label: 'Analysis', icon: '🧠' },
  { key: 'outreach', label: 'Outreach', icon: '📧' },
  { key: 'task', label: 'Tasks', icon: '⚡' },
  { key: 'sync', label: 'API Calls', icon: '🔄' },
]

const timeRanges = [
  { key: '1h', label: '1 Hour', ms: 60 * 60 * 1000 },
  { key: '24h', label: '24 Hours', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
]

function typeIcon(type: string): string {
  switch (type) {
    case 'scrape': return '🔍'
    case 'analysis': return '🧠'
    case 'outreach': return '📧'
    case 'task': return '⚡'
    case 'sync': return '🔄'
    case 'alert': return '🚨'
    case 'price_check': return '💰'
    default: return '📋'
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'scrape': return 'border-blue-500/30 bg-blue-500/5'
    case 'analysis': return 'border-purple-500/30 bg-purple-500/5'
    case 'outreach': return 'border-cyan-500/30 bg-cyan-500/5'
    case 'task': return 'border-yellow-500/30 bg-yellow-500/5'
    case 'sync': return 'border-gray-500/30 bg-gray-500/5'
    case 'alert': return 'border-red-500/30 bg-red-500/5'
    default: return 'border-gray-500/30 bg-gray-500/5'
  }
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case 'scrape': return 'bg-blue-500/20 text-blue-400'
    case 'analysis': return 'bg-purple-500/20 text-purple-400'
    case 'outreach': return 'bg-cyan-500/20 text-cyan-400'
    case 'task': return 'bg-yellow-500/20 text-yellow-400'
    case 'sync': return 'bg-gray-500/20 text-gray-400'
    case 'alert': return 'bg-red-500/20 text-red-400'
    default: return 'bg-gray-500/20 text-gray-400'
  }
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatFullTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function gradeMetadataColor(grade: string | undefined): string {
  switch (grade) {
    case 'must-buy': return 'text-green-400'
    case 'good-deal': return 'text-green-300'
    case 'fair': return 'text-yellow-300'
    case 'overpriced': return 'text-red-300'
    case 'suspicious': return 'text-red-400'
    default: return 'text-gray-400'
  }
}

export default function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState('')
  const [timeRange, setTimeRange] = useState('7d')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const since = useMemo(() => {
    const range = timeRanges.find(t => t.key === timeRange)
    return new Date(Date.now() - (range?.ms || 7 * 24 * 60 * 60 * 1000)).toISOString()
  }, [timeRange])

  const params = new URLSearchParams({ limit: '500', since })
  if (typeFilter) params.set('type', typeFilter)

  const { data, lastUpdated } = useLiveData<ActivityData>(`/api/activity?${params}`)

  const filteredEvents = useMemo(() => {
    if (!data?.events) return []
    if (!search.trim()) return data.events
    const q = search.toLowerCase()
    return data.events.filter(e =>
      e.title.toLowerCase().includes(q) ||
      (e.detail && e.detail.toLowerCase().includes(q))
    )
  }, [data?.events, search])

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { date: string; events: ActivityEvent[] }[] = []
    let currentDate = ''
    filteredEvents.forEach(e => {
      const d = new Date(e.timestamp)
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      if (dateStr !== currentDate) {
        currentDate = dateStr
        groups.push({ date: dateStr, events: [] })
      }
      groups[groups.length - 1].events.push(e)
    })
    return groups
  }, [filteredEvents])

  const stats = data?.stats

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Activity</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time tracker of everything the agent does</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator lastUpdated={lastUpdated} />
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-surface-secondary rounded-lg border border-gray-700 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Events</p>
            <p className="text-xl font-bold mt-1">{stats.totalEvents}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg border border-blue-500/20 p-3">
            <p className="text-xs text-blue-400 uppercase tracking-wider">Scrapes</p>
            <p className="text-xl font-bold mt-1 text-blue-400">{stats.scrapes}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg border border-purple-500/20 p-3">
            <p className="text-xs text-purple-400 uppercase tracking-wider">Analyzed</p>
            <p className="text-xl font-bold mt-1 text-purple-400">{stats.analyses}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg border border-cyan-500/20 p-3">
            <p className="text-xs text-cyan-400 uppercase tracking-wider">Outreach</p>
            <p className="text-xl font-bold mt-1 text-cyan-400">{stats.outreach}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg border border-yellow-500/20 p-3">
            <p className="text-xs text-yellow-400 uppercase tracking-wider">Tasks</p>
            <p className="text-xl font-bold mt-1 text-yellow-400">{stats.tasks}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg border border-gray-700 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">API Spend</p>
            <p className="text-xl font-bold mt-1">${stats.totalSpend.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-brand focus:outline-none"
          />
        </div>

        {/* Time range */}
        <div className="flex gap-1">
          {timeRanges.map(t => (
            <button
              key={t.key}
              onClick={() => setTimeRange(t.key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${timeRange === t.key ? 'bg-brand/20 text-brand border border-brand' : 'bg-surface-secondary border border-gray-700 text-gray-400 hover:border-gray-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5">
        {eventTypes.map(t => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5 ${typeFilter === t.key ? 'border-brand text-brand bg-brand/10' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="space-y-6">
        {groupedEvents.map(group => (
          <div key={group.date}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-medium text-gray-400">{group.date}</h3>
              <div className="flex-1 border-t border-gray-700/50" />
              <span className="text-xs text-gray-600">{group.events.length} events</span>
            </div>

            {/* Events */}
            <div className="space-y-1.5">
              {group.events.map(event => (
                <div
                  key={event.id}
                  onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  className={`rounded-lg border p-3 cursor-pointer transition-all hover:border-gray-500 ${typeColor(event.type)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon(event.type)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{event.title}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeBadgeColor(event.type)}`}>
                            {event.type}
                          </span>
                          {event.metadata?.grade && (
                            <span className={`text-xs font-medium ${gradeMetadataColor(event.metadata.grade)}`}>
                              {event.metadata.grade}
                            </span>
                          )}
                        </div>
                        {event.detail && (
                          <p className={`text-xs text-gray-500 mt-0.5 ${expandedId === event.id ? '' : 'truncate'}`}>
                            {event.detail}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500 whitespace-nowrap">{formatTimestamp(event.timestamp)}</p>
                      <p className="text-[10px] text-gray-600 whitespace-nowrap">{formatFullTimestamp(event.timestamp)}</p>
                    </div>
                  </div>

                  {/* Expanded metadata */}
                  {expandedId === event.id && event.metadata && (
                    <div className="mt-3 pt-3 border-t border-gray-700/30">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {Object.entries(event.metadata).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-gray-600">{key}: </span>
                            <span className="text-gray-300">{typeof value === 'number' ? (key === 'cost' ? `$${value.toFixed(4)}` : value.toFixed(2)) : String(value || '--')}</span>
                          </div>
                        ))}
                        <div>
                          <span className="text-gray-600">time: </span>
                          <span className="text-gray-300">{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {!data && (
          <div className="text-gray-400 text-center py-12">
            <div className="animate-pulse">Loading activity...</div>
          </div>
        )}
        {data && filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-2">No activity found</p>
            <p className="text-gray-600 text-sm">The agent hasn&apos;t done anything in this time range yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
