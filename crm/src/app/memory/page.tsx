'use client'

import { useState, useMemo } from 'react'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'

interface Memory {
  id: number
  category: string
  content: string
  context: string | null
  importance: string
  sourceEvent: string | null
  timesRecalled: number
  lastRecalledAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface MemoryData {
  memories: Memory[]
  stats: {
    total: number
    byCategory: { category: string; count: number }[]
    byImportance: { importance: string; count: number }[]
  }
}

const categories = [
  { key: '', label: 'All', icon: '🧠' },
  { key: 'seller_insight', label: 'Sellers', icon: '👤' },
  { key: 'market_trend', label: 'Market', icon: '📈' },
  { key: 'scraping_pattern', label: 'Scraping', icon: '🔍' },
  { key: 'strategy_learning', label: 'Strategy', icon: '♟️' },
  { key: 'pricing_insight', label: 'Pricing', icon: '💰' },
  { key: 'warning', label: 'Warnings', icon: '⚠️' },
]

function importanceColor(imp: string): string {
  switch (imp) {
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'normal': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'low': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

function categoryIcon(cat: string): string {
  return categories.find(c => c.key === cat)?.icon || '📋'
}

function timeAgo(date: string): string {
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function MemoryPage() {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [importanceFilter, setImportanceFilter] = useState('')
  const [search, setSearch] = useState('')

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: '200' })
    if (categoryFilter) p.set('category', categoryFilter)
    if (importanceFilter) p.set('importance', importanceFilter)
    if (search.trim()) p.set('search', search.trim())
    return p.toString()
  }, [categoryFilter, importanceFilter, search])

  const { data, lastUpdated } = useLiveData<MemoryData>(`/api/memory?${params}`)

  const memories = data?.memories || []
  const stats = data?.stats

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Memory</h1>
          <p className="text-sm text-gray-500 mt-1">What the agent has learned from past cycles</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator lastUpdated={lastUpdated} />
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-surface-secondary rounded-lg border border-gray-700 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
            <p className="text-xl font-bold mt-1">{stats.total}</p>
          </div>
          {stats.byCategory.map(c => (
            <div key={c.category} className="bg-surface-secondary rounded-lg border border-gray-700 p-3 cursor-pointer hover:border-gray-500" onClick={() => setCategoryFilter(categoryFilter === c.category ? '' : c.category)}>
              <p className="text-xs text-gray-500 uppercase tracking-wider">{categoryIcon(c.category)} {c.category.replace(/_/g, ' ')}</p>
              <p className="text-xl font-bold mt-1">{c.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search memories..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-secondary border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-brand focus:outline-none"
          />
        </div>
        <select
          value={importanceFilter}
          onChange={e => setImportanceFilter(e.target.value)}
          className="bg-surface-secondary border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:border-brand focus:outline-none"
        >
          <option value="">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map(c => (
          <button
            key={c.key}
            onClick={() => setCategoryFilter(categoryFilter === c.key ? '' : c.key)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5 ${categoryFilter === c.key ? 'border-brand text-brand bg-brand/10' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}
          >
            <span>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* Memory Cards */}
      <div className="space-y-2">
        {memories.map(m => (
          <div key={m.id} className={`rounded-lg border p-4 ${importanceColor(m.importance)}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="text-lg flex-shrink-0">{categoryIcon(m.category)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{m.content}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">{m.category.replace(/_/g, ' ')}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.importance === 'critical' ? 'bg-red-500/30 text-red-300' : m.importance === 'high' ? 'bg-orange-500/30 text-orange-300' : 'bg-gray-700/50 text-gray-400'}`}>{m.importance}</span>
                    {m.timesRecalled > 0 && (
                      <span className="text-[10px] text-gray-500">recalled {m.timesRecalled}x</span>
                    )}
                    {m.expiresAt && (
                      <span className="text-[10px] text-yellow-500">expires {timeAgo(m.expiresAt)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">{timeAgo(m.createdAt)}</p>
                {m.sourceEvent && <p className="text-[10px] text-gray-600">{m.sourceEvent}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!data && (
        <div className="text-gray-400 text-center py-12 animate-pulse">Loading memories...</div>
      )}
      {data && memories.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-2">No memories yet</p>
          <p className="text-gray-600 text-sm">The agent will start learning after its first scrape cycle</p>
        </div>
      )}
    </div>
  )
}
