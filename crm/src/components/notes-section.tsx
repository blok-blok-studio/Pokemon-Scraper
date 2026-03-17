'use client'

import { useState, useEffect } from 'react'
import { timeAgo } from '@/lib/utils'

interface Note {
  id: number
  body: string
  createdAt: string
}

export function NotesSection({ entityType, entityId }: { entityType: string; entityId: number }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/notes?entityType=${entityType}&entityId=${entityId}`)
      .then(r => r.json())
      .then(setNotes)
  }, [entityType, entityId])

  async function addNote() {
    if (!text.trim()) return
    setSaving(true)
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, entityType, entityId })
    })
    const note = await res.json()
    setNotes([note, ...notes])
    setText('')
    setSaving(false)
  }

  return (
    <div className="bg-surface-secondary rounded-xl border border-gray-700 p-5">
      <h2 className="font-semibold mb-4">Notes</h2>
      <div className="flex gap-2 mb-4">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNote()}
          placeholder="Add a note..."
          className="flex-1 bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
        />
        <button
          onClick={addNote}
          disabled={saving || !text.trim()}
          className="px-4 py-2 bg-brand text-black text-sm font-medium rounded-lg hover:bg-brand/80 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <div className="space-y-3">
        {notes.map(n => (
          <div key={n.id} className="py-2 border-b border-gray-700/50 last:border-0">
            <p className="text-sm">{n.body}</p>
            <p className="text-xs text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
          </div>
        ))}
        {notes.length === 0 && <p className="text-sm text-gray-500">No notes yet</p>}
      </div>
    </div>
  )
}
