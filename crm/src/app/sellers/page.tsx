'use client'

import { useState, useMemo, useCallback } from 'react'
import { timeAgo } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'
import Link from 'next/link'

interface Seller {
  id: number
  name: string
  type: string | null
  trustScore: number | null
  contactEmail: string | null
  contactPhone: string | null
  createdAt: string
  _count: { listings: number; outreach: number }
}

const sellerTypes = ['card_shop', 'pawn_shop', 'facebook_seller', 'online_seller']

type SortKey = 'name' | 'trust' | 'listings' | 'createdAt'

export default function SellersPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [hideUnknown, setHideUnknown] = useState(false)
  const [hasEmailOnly, setHasEmailOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('listings')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const params = useMemo(() => {
    const p = new URLSearchParams({ sortBy, sortDir })
    if (search.trim()) p.set('search', search.trim())
    if (typeFilter) p.set('type', typeFilter)
    if (hasEmailOnly) p.set('hasEmail', 'true')
    return p.toString()
  }, [search, typeFilter, hasEmailOnly, sortBy, sortDir])

  const { data: allSellers, lastUpdated } = useLiveData<Seller[]>(`/api/sellers?${params}`)

  // Client-side filter for hiding "unknown"
  const sellers = useMemo(() => {
    if (!allSellers) return null
    let filtered = allSellers
    if (hideUnknown) {
      filtered = filtered.filter(s => s.name.toLowerCase() !== 'unknown')
    }
    return filtered
  }, [allSellers, hideUnknown])

  const handleSort = useCallback((key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }, [sortBy])

  const clearAll = useCallback(() => {
    setSearch('')
    setTypeFilter('')
    setHideUnknown(false)
    setHasEmailOnly(false)
  }, [])

  const activeFilterCount = (typeFilter ? 1 : 0) + (hideUnknown ? 1 : 0) + (hasEmailOnly ? 1 : 0)

  // Stats
  const stats = useMemo(() => {
    if (!allSellers) return null
    const withEmail = allSellers.filter(s => s.contactEmail)
    const withTrust = allSellers.filter(s => s.trustScore != null)
    const totalListings = allSellers.reduce((s, x) => s + x._count.listings, 0)
    const unknown = allSellers.filter(s => s.name.toLowerCase() === 'unknown').length
    return {
      total: allSellers.length,
      withEmail: withEmail.length,
      withTrust: withTrust.length,
      totalListings,
      unknown,
    }
  }, [allSellers])

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortBy !== field) return <span className="text-gray-600 ml-1">↕</span>
    return <span className="text-brand ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const trustColor = (score: number) => {
    if (score >= 8) return 'text-green-400'
    if (score >= 5) return 'text-yellow-400'
    return 'text-red-400'
  }

  const trustBg = (score: number) => {
    if (score >= 8) return 'bg-green-500/20'
    if (score >= 5) return 'bg-yellow-500/20'
    return 'bg-red-500/20'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sellers</h1>
        <div className="flex items-center gap-3">
          <LiveIndicator lastUpdated={lastUpdated} />
          {stats && <p className="text-sm text-gray-400">{sellers?.length || 0} sellers</p>}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-surface-secondary rounded-lg border border-gray-700 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
            <p className="text-xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg border border-gray-700 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Listings</p>
            <p className="text-xl font-bold mt-1">{stats.totalListings}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg border border-cyan-500/20 p-3">
            <p className="text-xs text-cyan-400 uppercase tracking-wider">With Email</p>
            <p className="text-xl font-bold mt-1 text-cyan-400">{stats.withEmail}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg border border-green-500/20 p-3">
            <p className="text-xs text-green-400 uppercase tracking-wider">Trust Scored</p>
            <p className="text-xl font-bold mt-1 text-green-400">{stats.withTrust}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg border border-gray-700 p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Unknown</p>
            <p className="text-xl font-bold mt-1 text-gray-500">{stats.unknown}</p>
          </div>
        </div>
      )}

      {/* Search + Filter Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search sellers by name, email, type..."
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

          {/* Seller Type */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Seller Type</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTypeFilter('')}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${!typeFilter ? 'border-brand text-brand bg-brand/10' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}
              >
                All Types
              </button>
              {sellerTypes.map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all capitalize ${typeFilter === t ? 'border-brand text-brand bg-brand/10' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}
                >
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideUnknown}
                onChange={e => setHideUnknown(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand focus:ring-brand focus:ring-offset-0"
              />
              <span className="text-sm text-gray-400">Hide &quot;unknown&quot; sellers</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasEmailOnly}
                onChange={e => setHasEmailOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-brand focus:ring-brand focus:ring-offset-0"
              />
              <span className="text-sm text-gray-400">Has email only</span>
            </label>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-secondary rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs">
                <th className="text-left p-3 cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('name')}>
                  Name <SortIcon field="name" />
                </th>
                <th className="text-left p-3">Type</th>
                <th className="text-center p-3 cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('trust')}>
                  Trust <SortIcon field="trust" />
                </th>
                <th className="text-center p-3 cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('listings')}>
                  Listings <SortIcon field="listings" />
                </th>
                <th className="text-center p-3">Outreach</th>
                <th className="text-left p-3">Contact</th>
                <th className="text-right p-3 cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('createdAt')}>
                  Added <SortIcon field="createdAt" />
                </th>
              </tr>
            </thead>
            <tbody>
              {(sellers || []).map(s => (
                <tr key={s.id} className="border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors">
                  <td className="p-3">
                    <Link href={`/sellers/${s.id}`} className="group">
                      <p className="font-medium group-hover:text-brand transition-colors">
                        {s.name === 'unknown' ? <span className="text-gray-500 italic">unknown</span> : s.name}
                      </p>
                    </Link>
                  </td>
                  <td className="p-3">
                    {s.type ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-400 capitalize">{s.type.replace(/_/g, ' ')}</span>
                    ) : (
                      <span className="text-gray-600">--</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {s.trustScore != null ? (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${trustBg(s.trustScore)} ${trustColor(s.trustScore)}`}>
                        {s.trustScore}/10
                      </span>
                    ) : (
                      <span className="text-gray-600">--</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`font-medium ${s._count.listings > 10 ? 'text-brand' : s._count.listings > 0 ? 'text-gray-300' : 'text-gray-600'}`}>
                      {s._count.listings}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {s._count.outreach > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">{s._count.outreach}</span>
                    ) : (
                      <span className="text-gray-600">0</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="space-y-0.5">
                      {s.contactEmail && <p className="text-xs text-gray-400">{s.contactEmail}</p>}
                      {s.contactPhone && <p className="text-xs text-gray-500">{s.contactPhone}</p>}
                      {!s.contactEmail && !s.contactPhone && <span className="text-gray-600">--</span>}
                    </div>
                  </td>
                  <td className="p-3 text-right text-gray-500 text-xs whitespace-nowrap">{timeAgo(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!sellers && <div className="text-gray-400 text-center py-8 animate-pulse">Loading sellers...</div>}
        {sellers && sellers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No sellers found</p>
            {(search || activeFilterCount > 0) && (
              <button onClick={clearAll} className="text-sm text-brand hover:text-brand/80">Clear filters</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
