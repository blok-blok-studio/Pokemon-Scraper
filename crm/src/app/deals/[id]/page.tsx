'use client'

import { formatCurrency, formatPercent, gradeColor, stageColor, timeAgo } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DealActions } from './deal-actions'
import { NotesSection } from '@/components/notes-section'

interface Deal {
  id: number
  cardName: string | null
  title: string
  setName: string | null
  price: number
  tcgMarketPrice: number | null
  discountPercent: number | null
  dealGrade: string | null
  pipelineStage: string
  condition: string | null
  source: string
  url: string | null
  aiSummary: string | null
  redFlags: string | null
  foundAt: string
  seller: { id: number; name: string; trustScore: number | null } | null
}

interface PricePoint {
  id: number
  source: string
  price: number
  recordedAt: string
}

export default function DealDetail() {
  const params = useParams()
  const id = params.id as string

  const { data: deal, lastUpdated, refresh } = useLiveData<Deal>(`/api/deals/${id}`)
  const { data: priceHistory } = useLiveData<PricePoint[]>(`/api/deals/${id}/prices`, { interval: 60000 })

  if (!deal) return <div className="text-gray-400">Loading...</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/deals" className="hover:text-brand">Deals</Link>
          <span>/</span>
          <span className="text-white">{deal.cardName || 'Listing'}</span>
        </div>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <div className="bg-surface-secondary rounded-xl border border-gray-700 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{deal.cardName || deal.title}</h1>
            {deal.setName && <p className="text-gray-400 mt-1">{deal.setName}</p>}
            <div className="flex items-center gap-3 mt-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${gradeColor(deal.dealGrade)}`}>{deal.dealGrade || 'ungraded'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(deal.pipelineStage)}`}>{deal.pipelineStage}</span>
              <span className="text-xs text-gray-400">{deal.source}</span>
            </div>
          </div>
          <DealActions dealId={deal.id} currentStage={deal.pipelineStage} onUpdate={refresh} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-700">
          <div>
            <p className="text-xs text-gray-400">Price</p>
            <p className="text-lg font-bold">{formatCurrency(deal.price)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Market Price</p>
            <p className="text-lg font-bold text-gray-300">{formatCurrency(deal.tcgMarketPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Discount</p>
            <p className={`text-lg font-bold ${deal.discountPercent && deal.discountPercent > 20 ? 'text-green-400' : ''}`}>{formatPercent(deal.discountPercent)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Condition</p>
            <p className="text-lg font-bold">{deal.condition || '--'}</p>
          </div>
        </div>

        {deal.seller && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Seller</p>
            <Link href={`/sellers/${deal.seller.id}`} className="text-brand hover:underline">{deal.seller.name}</Link>
            {deal.seller.trustScore && <span className="ml-2 text-xs text-gray-400">Trust: {deal.seller.trustScore}/10</span>}
          </div>
        )}

        {deal.aiSummary && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-2">AI Analysis</p>
            <p className="text-sm leading-relaxed">{deal.aiSummary}</p>
          </div>
        )}

        {deal.redFlags && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-400 font-medium mb-1">Red Flags</p>
            <p className="text-sm text-red-300">{deal.redFlags}</p>
          </div>
        )}

        {deal.url && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <a href={deal.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline">View Original Listing &rarr;</a>
          </div>
        )}
      </div>

      {priceHistory && priceHistory.length > 0 && (
        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
          <h2 className="font-semibold mb-4">Price History</h2>
          <div className="space-y-2">
            {priceHistory.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-700/50 last:border-0">
                <span className="text-gray-400">{p.source}</span>
                <span className="font-medium">{formatCurrency(p.price)}</span>
                <span className="text-xs text-gray-500">{timeAgo(p.recordedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <NotesSection entityType="deal" entityId={deal.id} />
    </div>
  )
}
