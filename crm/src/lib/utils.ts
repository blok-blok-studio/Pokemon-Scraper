import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '--'
  return `$${amount.toFixed(2)}`
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '--'
  return `${Math.round(value)}%`
}

export function timeAgo(date: Date | string | null): string {
  if (!date) return '--'
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function gradeColor(grade: string | null): string {
  switch (grade) {
    case 'must-buy': return 'bg-green-500/20 text-green-400'
    case 'good-deal': return 'bg-green-500/10 text-green-300'
    case 'fair': return 'bg-yellow-500/10 text-yellow-300'
    case 'overpriced': return 'bg-red-500/10 text-red-300'
    case 'suspicious': return 'bg-red-500/20 text-red-400'
    default: return 'bg-gray-500/10 text-gray-400'
  }
}

export function stageColor(stage: string): string {
  switch (stage) {
    case 'new': return 'bg-blue-500/20 text-blue-400'
    case 'reviewing': return 'bg-yellow-500/20 text-yellow-400'
    case 'approved': return 'bg-green-500/20 text-green-400'
    case 'purchased': return 'bg-purple-500/20 text-purple-400'
    case 'passed': return 'bg-gray-500/20 text-gray-400'
    case 'pending': return 'bg-blue-500/20 text-blue-400'
    case 'sent': return 'bg-cyan-500/20 text-cyan-400'
    case 'replied': return 'bg-green-500/20 text-green-400'
    case 'converted': return 'bg-purple-500/20 text-purple-400'
    case 'dismissed': return 'bg-gray-500/20 text-gray-400'
    default: return 'bg-gray-500/20 text-gray-400'
  }
}
