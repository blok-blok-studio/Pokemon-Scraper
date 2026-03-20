'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ShoppingBag, Kanban, Users, Send, CheckSquare, Bookmark, DollarSign, Search, Activity, Brain } from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/deals', label: 'Deals', icon: ShoppingBag },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/sellers', label: 'Sellers', icon: Users },
  { href: '/outreach', label: 'Outreach', icon: Send },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { href: '/spend', label: 'API Spend', icon: DollarSign },
  { href: '/activity', label: 'Agent Activity', icon: Activity },
  { href: '/memory', label: 'Agent Memory', icon: Brain },
  { href: '/search', label: 'Search', icon: Search },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-surface-secondary border-r border-gray-700 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <Link href="/" className="text-brand font-bold text-lg">
          &#x1F0CF; Pokemon CRM
        </Link>
      </div>
      <nav className="flex-1 p-2">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 transition-colors',
              pathname === href
                ? 'bg-brand/10 text-brand'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
