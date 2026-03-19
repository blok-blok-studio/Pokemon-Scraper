'use client'

import { useState } from 'react'
import { formatCurrency, gradeColor, timeAgo } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'
import Link from 'next/link'

const STAGES = ['new', 'reviewing', 'approved', 'purchased', 'passed']
const STAGE_COLORS: Record<string, string> = {
  new: 'border-blue-500',
  reviewing: 'border-yellow-500',
  approved: 'border-green-500',
  purchased: 'border-purple-500',
  passed: 'border-gray-500',
}

interface Deal {
  id: number
  cardName: string
  setName: string | null
  price: number
  dealGrade: string | null
  pipelineStage: string
  foundAt: string
  source: string
}

export default function PipelinePage() {
  const { data: deals, lastUpdated, refresh } = useLiveData<Deal[]>('/api/deals?limit=200')
  const [dragging, setDragging] = useState<number | null>(null)
  const [localStages, setLocalStages] = useState<Record<number, string>>({})

  async function moveToStage(dealId: number, stage: string) {
    const previousStages = { ...localStages }
    setLocalStages(prev => ({ ...prev, [dealId]: stage }))
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStage: stage })
      })
      if (!res.ok) throw new Error('PATCH failed')
      refresh()
    } catch {
      // Revert optimistic update on failure
      setLocalStages(previousStages)
      refresh()
    }
  }

  function handleDragStart(e: React.DragEvent, dealId: number) {
    setDragging(dealId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, stage: string) {
    e.preventDefault()
    if (dragging !== null) {
      moveToStage(dragging, stage)
      setDragging(null)
    }
  }

  const displayDeals = (deals || []).map(d => ({
    ...d,
    pipelineStage: localStages[d.id] || d.pipelineStage,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pipeline</h1>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageDeals = displayDeals.filter(d => d.pipelineStage === stage)
          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-64 bg-surface-secondary rounded-xl border-t-2 ${STAGE_COLORS[stage]} border border-gray-700`}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, stage)}
            >
              <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{stage}</span>
                <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded-full">{stageDeals.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[200px] max-h-[600px] overflow-y-auto">
                {stageDeals.map(d => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={e => handleDragStart(e, d.id)}
                    className="bg-gray-800/80 rounded-lg p-3 cursor-grab active:cursor-grabbing border border-gray-700/50 hover:border-gray-600"
                  >
                    <Link href={`/deals/${d.id}`} className="hover:text-brand">
                      <p className="text-sm font-medium truncate">{d.cardName}</p>
                    </Link>
                    {d.setName && <p className="text-xs text-gray-400 truncate">{d.setName}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${gradeColor(d.dealGrade)}`}>{d.dealGrade || '?'}</span>
                      <span className="text-xs font-medium">{formatCurrency(d.price)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{timeAgo(d.foundAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
