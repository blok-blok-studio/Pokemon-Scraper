'use client'

import { stageColor, timeAgo } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { NotesSection } from '@/components/notes-section'

const STAGES = ['pending', 'sent', 'replied', 'converted', 'dismissed']

interface OutreachDetail {
  id: number
  targetName: string
  targetType: string
  contactMethod: string
  contactInfo: string
  subject: string | null
  messageSent: string | null
  status: string
  pipelineStage: string
  approved: boolean
  sentAt: string
  updatedAt: string | null
  seller: { id: number; name: string } | null
}

export default function OutreachDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [localStage, setLocalStage] = useState<string | null>(null)

  const { data: outreach, lastUpdated, refresh } = useLiveData<OutreachDetail>(`/api/outreach/${id}`)

  async function updateStage(stage: string) {
    setLocalStage(stage)
    await fetch(`/api/outreach/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineStage: stage })
    })
    setTimeout(refresh, 500)
  }

  if (!outreach) return <div className="text-gray-400">Loading...</div>

  const displayStage = localStage || outreach.pipelineStage

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/outreach" className="hover:text-brand">Outreach</Link>
          <span>/</span>
          <span className="text-white">{outreach.targetName}</span>
        </div>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <div className="bg-surface-secondary rounded-xl border border-gray-700 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{outreach.targetName}</h1>
            <p className="text-sm text-gray-400 mt-1">{outreach.contactMethod === 'voice' ? 'Phone' : 'Email'}: {outreach.contactInfo}</p>
            {outreach.subject && <p className="text-sm text-gray-300 mt-2">Subject: {outreach.subject}</p>}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(displayStage)}`}>{displayStage}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-700">
          <div>
            <p className="text-xs text-gray-400">Type</p>
            <p className="font-medium capitalize">{outreach.targetType}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Method</p>
            <p className="font-medium capitalize">{outreach.contactMethod}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Approved</p>
            <p className={`font-medium ${outreach.approved ? 'text-green-400' : 'text-gray-500'}`}>{outreach.approved ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Sent</p>
            <p className="font-medium">{timeAgo(outreach.sentAt)}</p>
          </div>
        </div>

        {outreach.seller && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Linked Seller</p>
            <Link href={`/sellers/${outreach.seller.id}`} className="text-brand hover:underline">{outreach.seller.name}</Link>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-2">Pipeline Stage</p>
          <div className="flex gap-1">
            {STAGES.map(s => (
              <button
                key={s}
                onClick={() => updateStage(s)}
                className={`px-3 py-1 text-xs rounded capitalize transition-colors ${
                  displayStage === s
                    ? 'bg-brand/20 text-brand'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {outreach.messageSent && (
        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
          <h2 className="font-semibold mb-4">{outreach.contactMethod === 'voice' ? 'Call Script / Transcript' : 'Message Sent'}</h2>
          <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap border border-gray-700/50 max-h-96 overflow-y-auto">
            {outreach.messageSent}
          </div>
        </div>
      )}

      <NotesSection entityType="outreach" entityId={outreach.id} />
    </div>
  )
}
