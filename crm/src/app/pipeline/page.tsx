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
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

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
      setLocalStages(previousStages)
      refresh()
    }
  }

  async function deleteDeal(dealId: number) {
    // Optimistic remove
    setDeletedIds(prev => new Set(prev).add(dealId))
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/deals/${dealId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('DELETE failed')
      refresh()
    } catch {
      // Revert on failure
      setDeletedIds(prev => {
        const next = new Set(prev)
        next.delete(dealId)
        return next
      })
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

  const displayDeals = (deals || [])
    .filter(d => !deletedIds.has(d.id))
    .map(d => ({
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
                    className="bg-gray-800/80 rounded-lg p-3 cursor-grab active:cursor-grabbing border border-gray-700/50 hover:border-gray-600 group relative"
                  >
                    {/* Trash icon — top right, only on hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirmDelete(confirmDelete === d.id ? null : d.id) }}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-all z-10"
                      title="Delete deal"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>

                    <Link href={`/deals/${d.id}`} className="hover:text-brand">
                      <p className="text-sm font-medium truncate pr-6">{d.cardName}</p>
                    </Link>
                    {d.setName && <p className="text-xs text-gray-400 truncate">{d.setName}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${gradeColor(d.dealGrade)}`}>{d.dealGrade || '?'}</span>
                      <span className="text-xs font-medium">{formatCurrency(d.price)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{timeAgo(d.foundAt)}</p>

                    {/* Confirm bar — slides in below the card content */}
                    {confirmDelete === d.id && (
                      <div className="mt-2 pt-2 border-t border-gray-700/50 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Delete this deal?</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteDeal(d.id) }}
                            className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(null) }}
                            className="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
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
