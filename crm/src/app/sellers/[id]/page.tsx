'use client'

import { formatCurrency, gradeColor, stageColor, timeAgo } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { NotesSection } from '@/components/notes-section'

interface SellerDetail {
  id: number
  name: string
  type: string | null
  trustScore: number | null
  trustReasoning: string | null
  contactEmail: string | null
  contactPhone: string | null
  createdAt: string
  listings: {
    id: number
    cardName: string
    source: string
    price: number
    dealGrade: string | null
    foundAt: string
  }[]
  outreach: {
    id: number
    contactMethod: string
    contactInfo: string
    pipelineStage: string
    sentAt: string
  }[]
}

export default function SellerDetailPage() {
  const params = useParams()
  const id = params.id as string

  const { data: seller, lastUpdated } = useLiveData<SellerDetail>(`/api/sellers/${id}`)

  if (!seller) return <div className="text-gray-400">Loading...</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/sellers" className="hover:text-brand">Sellers</Link>
          <span>/</span>
          <span className="text-white">{seller.name}</span>
        </div>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <div className="bg-surface-secondary rounded-xl border border-gray-700 p-6">
        <h1 className="text-xl font-bold">{seller.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <p className="text-xs text-gray-400">Type</p>
            <p className="font-medium capitalize">{seller.type || '--'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Trust Score</p>
            <p className={`font-medium ${seller.trustScore && seller.trustScore >= 7 ? 'text-green-400' : seller.trustScore && seller.trustScore >= 4 ? 'text-yellow-400' : ''}`}>
              {seller.trustScore != null ? `${seller.trustScore}/10` : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Email</p>
            <p className="text-sm">{seller.contactEmail || '--'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Phone</p>
            <p className="text-sm">{seller.contactPhone || '--'}</p>
          </div>
        </div>
        {seller.trustReasoning && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Trust Reasoning</p>
            <p className="text-sm">{seller.trustReasoning}</p>
          </div>
        )}
      </div>

      <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
        <h2 className="font-semibold mb-4">Listings ({seller.listings.length})</h2>
        <div className="space-y-2">
          {seller.listings.map(d => (
            <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0 hover:bg-gray-700/20 -mx-2 px-2 rounded">
              <div>
                <p className="text-sm font-medium">{d.cardName}</p>
                <p className="text-xs text-gray-400">{d.source} &middot; {timeAgo(d.foundAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${gradeColor(d.dealGrade)}`}>{d.dealGrade || '?'}</span>
                <span className="text-sm font-medium">{formatCurrency(d.price)}</span>
              </div>
            </Link>
          ))}
          {seller.listings.length === 0 && <p className="text-sm text-gray-500">No listings</p>}
        </div>
      </div>

      {seller.outreach.length > 0 && (
        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
          <h2 className="font-semibold mb-4">Outreach History</h2>
          <div className="space-y-2">
            {seller.outreach.map(o => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{o.contactMethod}: {o.contactInfo}</p>
                  <p className="text-xs text-gray-400">{timeAgo(o.sentAt)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(o.pipelineStage)}`}>{o.pipelineStage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <NotesSection entityType="seller" entityId={seller.id} />
    </div>
  )
}
