'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const stages = ['new', 'reviewing', 'approved', 'purchased', 'passed']

export function DealActions({ dealId, currentStage }: { dealId: number; currentStage: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStage(stage: string) {
    setLoading(true)
    await fetch('/api/deals/' + dealId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineStage: stage })
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex gap-1">
      {stages.map(s => (
        <button
          key={s}
          onClick={() => updateStage(s)}
          disabled={loading || s === currentStage}
          className={`px-2 py-1 text-xs rounded ${
            s === currentStage
              ? 'bg-brand/20 text-brand cursor-default'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          } disabled:opacity-50`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
