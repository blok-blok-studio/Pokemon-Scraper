'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'

interface WatchlistItem {
  id: number
  cardName: string
  setName: string | null
  maxPrice: number | null
  active: boolean
}

export default function WatchlistPage() {
  const { data: items, lastUpdated, refresh } = useLiveData<WatchlistItem[]>('/api/watchlist')
  const [cardName, setCardName] = useState('')
  const [setName, setSetName] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  async function addItem() {
    if (!cardName.trim()) return
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardName, setName: setName || null, maxPrice: maxPrice ? parseFloat(maxPrice) : null })
    })
    setCardName('')
    setSetName('')
    setMaxPrice('')
    refresh()
  }

  async function toggleActive(id: number, active: boolean) {
    await fetch(`/api/watchlist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active })
    })
    refresh()
  }

  async function deleteItem(id: number) {
    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' })
    refresh()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <div className="bg-surface-secondary rounded-xl border border-gray-700 p-4">
        <p className="text-sm text-gray-400 mb-3">Add a card to watch for deals</p>
        <div className="flex gap-2">
          <input value={cardName} onChange={e => setCardName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="Card name *" className="flex-1 bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand" />
          <input value={setName} onChange={e => setSetName(e.target.value)} placeholder="Set (optional)" className="w-40 bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand" />
          <input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} type="number" placeholder="Max $" className="w-24 bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand" />
          <button onClick={addItem} disabled={!cardName.trim()} className="px-4 py-2 bg-brand text-black text-sm font-medium rounded-lg hover:bg-brand/80 disabled:opacity-50">Add</button>
        </div>
      </div>

      <div className="space-y-2">
        {(items || []).map(item => (
          <div key={item.id} className={`bg-surface-secondary rounded-xl border border-gray-700 p-4 flex items-center gap-4 ${!item.active ? 'opacity-50' : ''}`}>
            <div className="flex-1">
              <p className="font-medium">{item.cardName}</p>
              <div className="flex gap-3 text-xs text-gray-400 mt-1">
                {item.setName && <span>{item.setName}</span>}
                {item.maxPrice && <span>Max: {formatCurrency(item.maxPrice)}</span>}
              </div>
            </div>
            <button onClick={() => toggleActive(item.id, item.active)} className={`px-3 py-1 text-xs rounded-full ${item.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
              {item.active ? 'Active' : 'Paused'}
            </button>
            <button onClick={() => deleteItem(item.id)} className="text-xs text-gray-500 hover:text-red-400">Remove</button>
          </div>
        ))}
        {!items && <div className="text-gray-400 text-center py-8">Loading...</div>}
        {items && items.length === 0 && <p className="text-gray-500 text-center py-8">No cards on watchlist</p>}
      </div>
    </div>
  )
}
