'use client'

import { useState, useEffect } from 'react'
import { stageColor, timeAgo } from '@/lib/utils'

const STAGES = ['pending', 'sent', 'replied', 'converted', 'dismissed']

interface Outreach {
  id: number
  targetName: string
  targetType: string
  contactMethod: string
  contactInfo: string
  subject?: string
  pipelineStage: string
  approved: boolean
  sentAt: string
  seller?: { id: number; name: string }
}

export default function OutreachPage() {
  const [items, setItems] = useState<Outreach[]>([])
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const url = filter ? `/api/outreach?stage=${filter}` : '/api/outreach'
    fetch(url).then(r => r.json()).then(setItems)
  }, [filter])

  async function updateOutreach(id: number, data: any) {
    await fetch('/api/outreach', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data })
    })
    setItems(prev => prev.map(o => o.id === id ? { ...o, ...data } : o))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Outreach</h1>

      <div className="flex gap-2">
        <button onClick={() => setFilter('')} className={`px-3 py-1 rounded-full text-xs border ${!filter ? 'border-brand text-brand' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>All</button>
        {STAGES.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded-full text-xs border capitalize ${filter === s ? 'border-brand text-brand' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>{s}</button>
        ))}
      </div>

      <div className="space-y-3">
        {items.map(o => (
          <div key={o.id} className="bg-surface-secondary rounded-xl border border-gray-700 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{o.targetName}</p>
                <p className="text-sm text-gray-400">{o.contactMethod}: {o.contactInfo}</p>
                <p className="text-xs text-gray-500 mt-1">{o.targetType} &middot; {timeAgo(o.sentAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(o.pipelineStage)}`}>{o.pipelineStage}</span>
                {!o.approved && o.pipelineStage === 'pending' && (
                  <>
                    <button
                      onClick={() => updateOutreach(o.id, { approved: true, pipelineStage: 'sent' })}
                      className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateOutreach(o.id, { pipelineStage: 'dismissed' })}
                      className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-1 mt-3">
              {STAGES.map(s => (
                <button
                  key={s}
                  onClick={() => updateOutreach(o.id, { pipelineStage: s })}
                  className={`px-2 py-0.5 text-xs rounded capitalize ${o.pipelineStage === s ? 'bg-brand/20 text-brand' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-500">No outreach records found</p>}
      </div>
    </div>
  )
}
