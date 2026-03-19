'use client'

import { useState } from 'react'
import { timeAgo } from '@/lib/utils'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'

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

interface AutomationTask {
  id: number
  localId: number
  taskType: string
  entityType: string | null
  entityId: number | null
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  createdAt: string
  completedAt: string | null
}

type TabView = 'manual' | 'automation'

const priorityColor: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400',
  normal: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
}

const typeLabel: Record<string, string> = {
  follow_up: 'Follow Up',
  callback: 'Callback',
  escalation: 'Escalation',
  watchlist: 'Watchlist',
}

export default function TasksPage() {
  const [tab, setTab] = useState<TabView>('automation')
  const [showCompleted, setShowCompleted] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [autoFilter, setAutoFilter] = useState<string>('')

  const manualUrl = `/api/tasks${showCompleted ? '' : '?completed=false'}`
  const { data: tasks, lastUpdated: manualUpdated, refresh: refreshManual } = useLiveData<Task[]>(manualUrl, { enabled: tab === 'manual' })

  const autoParams = new URLSearchParams()
  if (!showCompleted) autoParams.set('status', 'pending')
  if (autoFilter) autoParams.set('taskType', autoFilter)
  const autoUrl = `/api/automation-tasks?${autoParams}`
  const { data: autoTasks, lastUpdated: autoUpdated, refresh: refreshAuto } = useLiveData<AutomationTask[]>(autoUrl, { enabled: tab === 'automation' })

  async function addTask() {
    if (!newTitle.trim()) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, dueDate: newDue || null })
    })
    setNewTitle('')
    setNewDue('')
    refreshManual()
  }

  async function toggleComplete(id: number, completed: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed })
    })
    refreshManual()
  }

  async function deleteTask(id: number) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    refreshManual()
  }

  async function completeAutoTask(id: number) {
    await fetch(`/api/automation-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    })
    refreshAuto()
  }

  async function dismissAutoTask(id: number) {
    await fetch(`/api/automation-tasks/${id}`, { method: 'DELETE' })
    refreshAuto()
  }

  const displayAuto = autoTasks || []
  const displayManual = tasks || []
  const pendingCount = displayAuto.filter(t => t.status === 'pending').length
  const highPriority = displayAuto.filter(t => t.priority === 'high').length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          {tab === 'automation' && pendingCount > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              {pendingCount} pending{highPriority > 0 ? ` (${highPriority} high priority)` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator lastUpdated={tab === 'automation' ? autoUpdated : manualUpdated} />
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            {showCompleted ? 'Hide completed' : 'Show completed'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('automation')}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === 'automation' ? 'bg-brand text-black font-medium' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Agent Tasks {pendingCount > 0 && <span className="ml-1 text-xs">({pendingCount})</span>}
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === 'manual' ? 'bg-brand text-black font-medium' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Manual Tasks
        </button>
      </div>

      {tab === 'automation' && (
        <>
          <div className="flex gap-2 flex-wrap">
            {['', 'follow_up', 'callback', 'escalation', 'watchlist'].map(type => (
              <button
                key={type}
                onClick={() => setAutoFilter(type)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  autoFilter === type
                    ? 'bg-brand/20 text-brand border-brand'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                {type ? typeLabel[type] || type : 'All'}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {displayAuto.map(t => (
              <div key={t.id} className={`bg-surface-secondary rounded-xl border border-gray-700 p-4 ${t.status === 'completed' ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${priorityColor[t.priority] || 'bg-gray-500/20 text-gray-400'}`}>
                        {t.priority}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">
                        {typeLabel[t.taskType] || t.taskType}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.description && <p className="text-xs text-gray-400 mt-1">{t.description}</p>}
                    <div className="flex gap-3 mt-2">
                      {t.dueDate && (
                        <span className={`text-xs ${new Date(t.dueDate) < new Date() ? 'text-red-400' : 'text-gray-500'}`}>
                          Due: {new Date(t.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{timeAgo(t.createdAt)}</span>
                    </div>
                  </div>
                  {t.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => completeAutoTask(t.id)}
                        className="px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => dismissAutoTask(t.id)}
                        className="px-3 py-1 text-xs text-gray-500 hover:text-red-400"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!autoTasks && <div className="text-gray-400 text-center py-8">Loading...</div>}
            {autoTasks && displayAuto.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No automation tasks — the agent creates these automatically from outreach and deal analysis
              </p>
            )}
          </div>
        </>
      )}

      {tab === 'manual' && (
        <>
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
            {displayManual.map(t => (
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
            {!tasks && <div className="text-gray-400 text-center py-8">Loading...</div>}
            {tasks && displayManual.length === 0 && <p className="text-gray-500 text-center py-8">No tasks — add one above</p>}
          </div>
        </>
      )}
    </div>
  )
}
