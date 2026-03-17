'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'

interface SpendData {
  today: number
  month: number
  byService: { service: string; cost: number; tokensIn: number; tokensOut: number; calls: number }[]
  dailyBreakdown: { date: string; service: string; cost: number; calls: number }[]
  totalRecords: number
}

export default function SpendPage() {
  const [data, setData] = useState<SpendData | null>(null)

  useEffect(() => {
    fetch('/api/spend').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="text-gray-400">Loading...</div>

  const dailyTotals: Record<string, number> = {}
  data.dailyBreakdown.forEach(d => {
    const dateStr = typeof d.date === 'string' ? d.date.split('T')[0] : new Date(d.date).toISOString().split('T')[0]
    dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + (d.cost || 0)
  })
  const sortedDays = Object.entries(dailyTotals).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30)
  const maxDailyCost = Math.max(...Object.values(dailyTotals), 0.01)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">API Spend</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-4">
          <p className="text-xs text-gray-400">Today</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data.today)}</p>
        </div>
        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-4">
          <p className="text-xs text-gray-400">This Month</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data.month)}</p>
        </div>
        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-4">
          <p className="text-xs text-gray-400">Total API Calls</p>
          <p className="text-2xl font-bold mt-1">{data.totalRecords.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
        <h2 className="font-semibold mb-4">By Service</h2>
        <div className="space-y-3">
          {data.byService.map(s => (
            <div key={s.service} className="flex items-center gap-4">
              <span className="w-28 text-sm font-medium truncate">{s.service}</span>
              <div className="flex-1 bg-gray-700/50 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-brand h-full rounded-full"
                  style={{ width: `${Math.max((s.cost / (data.month || 1)) * 100, 2)}%` }}
                />
              </div>
              <span className="text-sm font-medium w-20 text-right">{formatCurrency(s.cost)}</span>
              <span className="text-xs text-gray-400 w-20 text-right">{s.calls} calls</span>
            </div>
          ))}
          {data.byService.length === 0 && <p className="text-sm text-gray-500">No usage data yet</p>}
        </div>
      </div>

      <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
        <h2 className="font-semibold mb-4">Daily Spend (last 30 days)</h2>
        <div className="space-y-1">
          {sortedDays.map(([date, cost]) => (
            <div key={date} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-24">{date}</span>
              <div className="flex-1 bg-gray-700/50 rounded-full h-3 overflow-hidden">
                <div className="bg-brand/60 h-full rounded-full" style={{ width: `${(cost / maxDailyCost) * 100}%` }} />
              </div>
              <span className="text-xs font-medium w-16 text-right">{formatCurrency(cost)}</span>
            </div>
          ))}
          {sortedDays.length === 0 && <p className="text-sm text-gray-500">No daily data yet</p>}
        </div>
      </div>
    </div>
  )
}
