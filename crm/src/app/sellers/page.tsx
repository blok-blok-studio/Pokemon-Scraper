import { prisma } from '@/lib/prisma'
import { timeAgo } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function SellersPage() {
  const sellers = await prisma.seller.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { listings: true, outreach: true } }
    }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sellers</h1>

      <div className="bg-surface-secondary rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Type</th>
              <th className="text-center p-3">Trust</th>
              <th className="text-center p-3">Listings</th>
              <th className="text-center p-3">Outreach</th>
              <th className="text-left p-3">Email</th>
              <th className="text-right p-3">Added</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map(s => (
              <tr key={s.id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                <td className="p-3">
                  <Link href={`/sellers/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link>
                </td>
                <td className="p-3 text-gray-400 capitalize">{s.type || '--'}</td>
                <td className="p-3 text-center">
                  {s.trustScore != null ? (
                    <span className={`font-medium ${s.trustScore >= 7 ? 'text-green-400' : s.trustScore >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {s.trustScore}/10
                    </span>
                  ) : '--'}
                </td>
                <td className="p-3 text-center">{s._count.listings}</td>
                <td className="p-3 text-center">{s._count.outreach}</td>
                <td className="p-3 text-gray-400 text-xs">{s.contactEmail || '--'}</td>
                <td className="p-3 text-right text-gray-400 text-xs">{timeAgo(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sellers.length === 0 && <p className="p-6 text-center text-gray-500">No sellers yet — they are auto-created when deals sync</p>}
      </div>
    </div>
  )
}
