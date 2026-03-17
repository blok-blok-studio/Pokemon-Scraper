'use client'

import { useState } from 'react'
import { formatCurrency, gradeColor, stageColor, timeAgo } from '@/lib/utils'
import Link from 'next/link'

interface SearchResults {
  deals: { items: any[]; count: number }
  sellers: { items: any[]; count: number }
  outreach: { items: any[]; count: number }
  total: number
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)

  async function search() {
    if (query.length < 2) return
    setLoading(true)
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
    setResults(await res.json())
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Search</h1>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search deals, sellers, outreach..."
          className="flex-1 bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand"
        />
        <button onClick={search} disabled={loading || query.length < 2} className="px-6 py-3 bg-brand text-black text-sm font-medium rounded-lg hover:bg-brand/80 disabled:opacity-50">
          Search
        </button>
      </div>

      {results && (
        <div className="space-y-6">
          <p className="text-sm text-gray-400">{results.total} results for &ldquo;{query}&rdquo;</p>

          {results.deals.count > 0 && (
            <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
              <h2 className="font-semibold mb-3">Deals ({results.deals.count})</h2>
              <div className="space-y-2">
                {results.deals.items.map((d: any) => (
                  <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0 hover:bg-gray-700/20 -mx-2 px-2 rounded">
                    <div>
                      <p className="text-sm font-medium">{d.cardName || d.title}</p>
                      <p className="text-xs text-gray-400">{d.source} &middot; {d.sellerName || 'Unknown seller'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${gradeColor(d.dealGrade)}`}>{d.dealGrade || '?'}</span>
                      <span className="text-sm font-medium">{formatCurrency(d.price)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.sellers.count > 0 && (
            <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
              <h2 className="font-semibold mb-3">Sellers ({results.sellers.count})</h2>
              <div className="space-y-2">
                {results.sellers.items.map((s: any) => (
                  <Link key={s.id} href={`/sellers/${s.id}`} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0 hover:bg-gray-700/20 -mx-2 px-2 rounded">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.type || 'Unknown type'} &middot; {s.contactEmail || 'No email'}</p>
                    </div>
                    {s.trustScore != null && <span className="text-sm font-medium">{s.trustScore}/10</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.outreach.count > 0 && (
            <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
              <h2 className="font-semibold mb-3">Outreach ({results.outreach.count})</h2>
              <div className="space-y-2">
                {results.outreach.items.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{o.targetName}</p>
                      <p className="text-xs text-gray-400">{o.contactMethod}: {o.contactInfo} &middot; {timeAgo(o.sentAt)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(o.pipelineStage)}`}>{o.pipelineStage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.total === 0 && <p className="text-gray-500 text-center py-8">No results found</p>}
        </div>
      )}
    </div>
  )
}
