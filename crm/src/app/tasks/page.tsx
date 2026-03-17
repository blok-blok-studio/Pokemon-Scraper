'use client'

import { useState, useEffect } from 'react'
import { timeAgo } from '@/lib/utils'

interface Task {
  id: number
  title: string
  description: string | null
  dueDate: string | null
  completed: boolean
  entityType: string | null
  entityId: number | null
  createdAt: string
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')

  useEffect(() => {
    fetch(`/api/tasks${showCompleted ? '' : '?completed=false'}`)
      .then(r => r.json())
      .then(setTasks)
  }, [showCompleted])

  async function addTask() {
    if (!newTitle.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, dueDate: newDue || null })
    })
    const task = await res.json()
    setTasks([task, ...tasks])
    setNewTitle('')
    setNewDue('')
  }

  async function toggleComplete(id: number, completed: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed })
    })
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t))
  }

  async function deleteTask(id: number) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="New task..."
          className="flex-1 bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
        />
        <input
          type="date"
          value={newDue}
          onChange={e => setNewDue(e.target.value)}
          className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand"
        />
        <button
          onClick={addTask}
          disabled={!newTitle.trim()}
          className="px-4 py-2 bg-brand text-black text-sm font-medium rounded-lg hover:bg-brand/80 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id} className={`bg-surface-secondary rounded-xl border border-gray-700 p-4 flex items-center gap-3 ${t.completed ? 'opacity-50' : ''}`}>
            <button
              onClick={() => toggleComplete(t.id, t.completed)}
              className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${t.completed ? 'bg-brand border-brand text-black' : 'border-gray-500 hover:border-brand'}`}
            >
              {t.completed && <span className="text-xs">&#10003;</span>}
            </button>
            <div className="flex-1">
              <p className={`text-sm font-medium ${t.completed ? 'line-through' : ''}`}>{t.title}</p>
              {t.description && <p className="text-xs text-gray-400">{t.description}</p>}
              <div className="flex gap-3 mt-1">
                {t.dueDate && <span className="text-xs text-gray-500">Due: {new Date(t.dueDate).toLocaleDateString()}</span>}
                <span className="text-xs text-gray-500">{timeAgo(t.createdAt)}</span>
              </div>
            </div>
            <button onClick={() => deleteTask(t.id)} className="text-xs text-gray-500 hover:text-red-400">Delete</button>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-gray-500 text-center py-8">No tasks — add one above</p>}
      </div>
    </div>
  )
}
