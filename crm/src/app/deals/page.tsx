'use client'

import { useState, useMemo, useCallback } from 'react'
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
  url: string | null
  foundAt: string
  seller: { id: number; name: string } | null
}

const grades = ['must-buy', 'good-deal', 'fair', 'overpriced', 'suspicious', 'ungraded']
const stages = ['new', 'reviewing', 'approved', 'purchased', 'passed']
const sources = ['ebay', 'tcgplayer', 'trollandtoad']

type SortKey = 'foundAt' | 'price' | 'discount' | 'market' | 'grade'

export default function DealsPage() {
  // Filters
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState<string[]>([])
  const [stageFilter, setStageFilter] = useState<string[]>([])
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [hasMarketPrice, setHasMarketPrice] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Sorting
  const [sortBy, setSortBy] = useState<SortKey>('foundAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Build API params
  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: '500', sortBy, sortDir })
    if (search.trim()) p.set('search', search.trim())
    if (minPrice) p.set('minPrice', minPrice)
    if (maxPrice) p.set('maxPrice', maxPrice)
    if (hasMarketPrice) p.set('hasMarketPrice', 'true')
    return p.toString()
  }, [search, minPrice, maxPrice, hasMarketPrice, sortBy, sortDir])

  const { data: allDeals, lastUpdated, refresh } = useLiveData<Deal[]>(`/api/deals?${params}`)
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  async function deleteDeal(dealId: number) {
    setDeletedIds(prev => new Set(prev).add(dealId))
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/deals/${dealId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('DELETE failed')
      refresh()
    } catch {
      setDeletedIds(prev => { const n = new Set(prev); n.delete(dealId); return n })
      refresh()
    }
  }

  // Client-side multi-select filters (grade, stage, source support multi-select)
  const deals = useMemo(() => {
    if (!allDeals) return null
    return allDeals.filter(d => {
      if (deletedIds.has(d.id)) return false
      if (gradeFilter.length > 0) {
        const dGrade = d.dealGrade || 'ungraded'
        if (!gradeFilter.includes(dGrade)) return false
      }
      if (stageFilter.length > 0 && !stageFilter.includes(d.pipelineStage)) return false
      if (sourceFilter.length > 0 && !sourceFilter.includes(d.source)) return false
      return true
    })
  }, [allDeals, gradeFilter, stageFilter, sourceFilter])

  const toggleFilter = useCallback((arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val])
  }, [])

  const handleSort = useCallback((key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }, [sortBy])

  const clearAll = useCallback(() => {
    setSearch('')
    setGradeFilter([])
    setStageFilter([])
    setSourceFilter([])
    setMinPrice('')
    setMaxPrice('')
    setHasMarketPrice(false)
  }, [])

  const activeFilterCount = gradeFilter.length + stageFilter.length + sourceFilter.length + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (hasMarketPrice ? 1 : 0)

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortBy !== field) return <span className="text-gray-600 ml-1">↕</span>
    return <span className="text-brand ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Stats
  const stats = useMemo(() => {
    if (!deals) return null
    const withMarket = deals.filter(d => d.tcgMarketPrice)
    const graded = deals.filter(d => d.dealGrade && d.dealGrade !== 'ungraded')
    const mustBuys = deals.filter(d => d.dealGrade === 'must-buy')
    const goodDeals = deals.filter(d => d.dealGrade === 'good-deal')
    return {
      total: deals.length,
      withMarket: withMarket.length,
      graded: graded.length,
      mustBuys: mustBuys.length,
      goodDeals: goodDeals.length,
    }
  }, [deals])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deals</h1>
        <div className="flex items-center gap-3">
          <LiveIndicator lastUpdated={lastUpdated} />
          {stats && <p className="text-sm text-gray-400">{stats.total} results</p>}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search cards, sets, sellers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-secondary border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2.5 rounded-lg border text-sm flex items-center gap-2 transition-colors ${showFilters || activeFilterCount > 0 ? 'border-brand text-brand bg-brand/10' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-brand text-black text-xs font-bold px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-surface-secondary rounded-xl border border-gray-700 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">Filters</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="text-xs text-brand hover:text-brand/80">Clear all</button>
            )}
          </div>

          {/* Grade filter */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Grade</label>
            <div className="flex flex-wrap gap-1.5">
              {grades.map(g => (
                <button
                  key={g}
                  onClick={() => toggleFilter(gradeFilter, setGradeFilter, g)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${gradeFilter.includes(g) ? 'border-brand text-brand bg-brand/10' : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Stage filter */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Pipeline Stage</label>
            <div className="flex flex-wrap gap-1.5">
              {stages.map(s => (
                <button
                  key={s}
                  onClick={() => toggleFilter(stageFilter, setStageFilter, s)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${stageFilter.includes(s) ? 'border-brand text-brand bg-brand/10' : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Source filter */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Source</label>
            <div className="flex flex-wrap gap-1.5">
              {sources.map(s => (
                <button
                  key={s}
                  onClick={() => toggleFilter(sourceFilter, setSourceFilter, s)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${sourceFilter.includes(s) ? 'border-brand text-brand bg-brand/10' : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Price range + toggles */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Price Range</label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={e => setMinPrice(e.target.value)}
                    className="w-24 pl-6 pr-2 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-600 focus:border-brand focus:outline-none"
                  />
                </div>
                <span className="text-gray-500">—</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    className="w-24 pl-6 pr-2 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-600 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pb-1">
              <input
                type="checkbox"
                checked={hasMarketPrice}
                onChange={e => setHasMarketPrice(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand focus:ring-brand focus:ring-offset-0"
              />
              <span className="text-sm text-gray-400">Has market price</span>
            </label>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="flex gap-4 text-xs text-gray-500">
          <span>{stats.withMarket} with market price</span>
          <span>{stats.graded} graded</span>
          {stats.mustBuys > 0 && <span className="text-green-400">{stats.mustBuys} must-buy</span>}
          {stats.goodDeals > 0 && <span className="text-green-300">{stats.goodDeals} good deals</span>}
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-secondary rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs">
                <th className="text-left p-3 min-w-[250px]">Card</th>
                <th className="text-left p-3">Source</th>
                <th className="text-right p-3 cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('price')}>
                  Price <SortIcon field="price" />
                </th>
                <th className="text-right p-3 cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('market')}>
                  Market <SortIcon field="market" />
                </th>
                <th className="text-right p-3 cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('discount')}>
                  Discount <SortIcon field="discount" />
                </th>
                <th className="text-center p-3">Grade</th>
                <th className="text-center p-3">Stage</th>
                <th className="text-right p-3 cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('foundAt')}>
                  Found <SortIcon field="foundAt" />
                </th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(deals || []).map(d => (
                <tr key={d.id} className="border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors group">
                  <td className="p-3">
                    <Link href={`/deals/${d.id}`} className="hover:text-brand group">
                      <p className="font-medium truncate max-w-[300px] group-hover:text-brand transition-colors">{d.cardName || d.title}</p>
                      {d.setName && <p className="text-xs text-gray-500 truncate max-w-[300px]">{d.setName}</p>}
                      {d.seller && <p className="text-xs text-gray-600">{d.seller.name}</p>}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-400">{d.source}</span>
                  </td>
                  <td className="p-3 text-right font-medium tabular-nums">{formatCurrency(d.price)}</td>
                  <td className="p-3 text-right tabular-nums">
                    {d.tcgMarketPrice ? (
                      <span className="text-gray-300">{formatCurrency(d.tcgMarketPrice)}</span>
                    ) : (
                      <span className="text-gray-600">--</span>
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {d.discountPercent ? (
                      <span className={`font-medium ${d.discountPercent > 30 ? 'text-green-400' : d.discountPercent > 15 ? 'text-green-300' : d.discountPercent > 0 ? 'text-gray-300' : 'text-red-300'}`}>
                        {d.discountPercent > 0 ? '-' : '+'}{formatPercent(Math.abs(d.discountPercent))}
                      </span>
                    ) : (
                      <span className="text-gray-600">--</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${gradeColor(d.dealGrade)}`}>
                      {d.dealGrade || 'ungraded'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(d.pipelineStage)}`}>
                      {d.pipelineStage}
                    </span>
                  </td>
                  <td className="p-3 text-right text-gray-500 text-xs whitespace-nowrap">{timeAgo(d.foundAt)}</td>
                  <td className="p-3 text-center">
                    {confirmDelete === d.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteDeal(d.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40">Yes</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 hover:bg-gray-600">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(d.id)}
                        className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!deals && (
          <div className="text-gray-400 text-center py-12">
            <div className="animate-pulse">Loading deals...</div>
          </div>
        )}
        {deals && deals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No deals found</p>
            {(search || activeFilterCount > 0) && (
              <button onClick={clearAll} className="text-sm text-brand hover:text-brand/80">Clear filters</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
