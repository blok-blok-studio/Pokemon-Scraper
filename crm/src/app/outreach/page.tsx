'use client'

import { useState } from 'react'
import { stageColor, timeAgo } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'
import Link from 'next/link'

const STAGES = ['pending', 'sent', 'replied', 'converted', 'dismissed']

interface Outreach {
  id: number
  targetName: string
  targetType: string
  contactMethod: string
  contactInfo: string
  subject?: string
  messageSent?: string
  pipelineStage: string
  approved: boolean
  sentAt: string
  seller?: { id: number; name: string }
}

export default function OutreachPage() {
  const [filter, setFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [localOverrides, setLocalOverrides] = useState<Record<number, Partial<Outreach>>>({})

  const url = filter ? `/api/outreach?stage=${filter}` : '/api/outreach'
  const { data: items, lastUpdated, refresh } = useLiveData<Outreach[]>(url)

  async function updateOutreach(id: number, data: any) {
    await fetch('/api/outreach', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data })
    })
    setLocalOverrides(prev => ({ ...prev, [id]: { ...prev[id], ...data } }))
    setTimeout(refresh, 500)
  }

  const displayItems = (items || []).map(o => ({ ...o, ...localOverrides[o.id] }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Outreach</h1>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <div className="flex gap-2">
        <button onClick={() => setFilter('')} className={`px-3 py-1 rounded-full text-xs border ${!filter ? 'border-brand text-brand' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>All</button>
        {STAGES.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded-full text-xs border capitalize ${filter === s ? 'border-brand text-brand' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>{s}</button>
        ))}
      </div>

      <div className="space-y-3">
        {displayItems.map(o => (
          <div key={o.id} className="bg-surface-secondary rounded-xl border border-gray-700 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <Link href={`/outreach/${o.id}`} className="font-medium hover:text-brand">{o.targetName}</Link>
                <p className="text-sm text-gray-400">{o.contactMethod === 'voice' ? '📞' : '📧'} {o.contactMethod}: {o.contactInfo}</p>
                {o.subject && <p className="text-sm text-gray-300 mt-1">Subject: {o.subject}</p>}
                <p className="text-xs text-gray-500 mt-1">{o.targetType} &middot; {timeAgo(o.sentAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(o.pipelineStage)}`}>{o.pipelineStage}</span>
                {!o.approved && o.pipelineStage === 'pending' && (
                  <>
                    <button onClick={() => updateOutreach(o.id, { approved: true, pipelineStage: 'sent' })} className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">Approve</button>
                    <button onClick={() => updateOutreach(o.id, { pipelineStage: 'dismissed' })} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">Dismiss</button>
                  </>
                )}
              </div>
            </div>
            {o.messageSent && (
              <div className="mt-3">
                <button onClick={() => setExpandedId(expandedId === o.id ? null : o.id)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  <span>{expandedId === o.id ? '▼' : '▶'}</span>
                  {o.contactMethod === 'voice' ? 'View call script' : 'View message sent'}
                </button>
                {expandedId === o.id && (
                  <div className="mt-2 bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap border border-gray-700/50 max-h-64 overflow-y-auto">{o.messageSent}</div>
                )}
              </div>
            )}
            <div className="flex gap-1 mt-3">
              {STAGES.map(s => (
                <button key={s} onClick={() => updateOutreach(o.id, { pipelineStage: s })} className={`px-2 py-0.5 text-xs rounded capitalize ${o.pipelineStage === s ? 'bg-brand/20 text-brand' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>{s}</button>
              ))}
            </div>
          </div>
        ))}
        {!items && <div className="text-gray-400 text-center py-8">Loading...</div>}
        {items && items.length === 0 && <p className="text-gray-500">No outreach records found</p>}
      </div>
    </div>
  )
}
