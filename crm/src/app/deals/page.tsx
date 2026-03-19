'use client'

import { useState } from 'react'
import { formatCurrency, formatPercent, gradeColor, stageColor, timeAgo } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'
import Link from 'next/link'

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
  source: string
  foundAt: string
  seller: { id: number; name: string } | null
}

const grades = ['must-buy', 'good-deal', 'fair', 'overpriced', 'suspicious']
const stages = ['new', 'reviewing', 'approved', 'purchased', 'passed']

export default function DealsPage() {
  const [gradeFilter, setGradeFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  const params = new URLSearchParams({ limit: '100' })
  if (gradeFilter) params.set('grade', gradeFilter)
  if (stageFilter) params.set('stage', stageFilter)

  const { data: deals, lastUpdated } = useLiveData<Deal[]>(`/api/deals?${params}`)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deals</h1>
        <div className="flex items-center gap-3">
          <LiveIndicator lastUpdated={lastUpdated} />
          <p className="text-sm text-gray-400">{deals ? `${deals.length} results` : ''}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setGradeFilter(''); setStageFilter('') }} className={`px-3 py-1 rounded-full text-xs border ${!gradeFilter && !stageFilter ? 'border-brand text-brand' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>All</button>
        {grades.map(g => (
          <button key={g} onClick={() => { setGradeFilter(g); setStageFilter('') }} className={`px-3 py-1 rounded-full text-xs border ${gradeFilter === g ? 'border-brand text-brand' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>{g}</button>
        ))}
        <span className="border-l border-gray-600 mx-1" />
        {stages.map(s => (
          <button key={s} onClick={() => { setStageFilter(s); setGradeFilter('') }} className={`px-3 py-1 rounded-full text-xs border ${stageFilter === s ? 'border-brand text-brand' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>{s}</button>
        ))}
      </div>

      <div className="bg-surface-secondary rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs">
              <th className="text-left p-3">Card</th>
              <th className="text-left p-3">Source</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3">Market</th>
              <th className="text-right p-3">Discount</th>
              <th className="text-center p-3">Grade</th>
              <th className="text-center p-3">Stage</th>
              <th className="text-right p-3">Found</th>
            </tr>
          </thead>
          <tbody>
            {(deals || []).map(d => (
              <tr key={d.id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                <td className="p-3">
                  <Link href={`/deals/${d.id}`} className="hover:text-brand">
                    <p className="font-medium truncate max-w-[250px]">{d.cardName || d.title}</p>
                    {d.setName && <p className="text-xs text-gray-400">{d.setName}</p>}
                  </Link>
                </td>
                <td className="p-3 text-gray-400">{d.source}</td>
                <td className="p-3 text-right font-medium">{formatCurrency(d.price)}</td>
                <td className="p-3 text-right text-gray-400">{formatCurrency(d.tcgMarketPrice)}</td>
                <td className="p-3 text-right">{d.discountPercent ? <span className={d.discountPercent > 20 ? 'text-green-400' : 'text-gray-300'}>{formatPercent(d.discountPercent)}</span> : '--'}</td>
                <td className="p-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${gradeColor(d.dealGrade)}`}>{d.dealGrade || 'ungraded'}</span></td>
                <td className="p-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(d.pipelineStage)}`}>{d.pipelineStage}</span></td>
                <td className="p-3 text-right text-gray-400 text-xs">{timeAgo(d.foundAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!deals && <div className="text-gray-400 text-center py-8">Loading...</div>}
        {deals && deals.length === 0 && <p className="p-6 text-center text-gray-500">No deals found</p>}
      </div>
    </div>
  )
}
