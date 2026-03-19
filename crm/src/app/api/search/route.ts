import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 100)

    if (!q || q.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    const [deals, sellers, outreach] = await Promise.all([
      prisma.cardListing.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { cardName: { contains: q, mode: 'insensitive' } },
            { setName: { contains: q, mode: 'insensitive' } },
            { sellerName: { contains: q, mode: 'insensitive' } },
          ]
        },
        take: limit,
        orderBy: { foundAt: 'desc' }
      }),
      prisma.seller.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { contactEmail: { contains: q, mode: 'insensitive' } },
          ]
        },
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.outreachLog.findMany({
        where: {
          OR: [
            { targetName: { contains: q, mode: 'insensitive' } },
            { contactInfo: { contains: q, mode: 'insensitive' } },
            { subject: { contains: q, mode: 'insensitive' } },
          ]
        },
        take: limit,
        orderBy: { sentAt: 'desc' }
      })
    ])

    return NextResponse.json({
      deals: { items: deals, count: deals.length },
      sellers: { items: sellers, count: sellers.length },
      outreach: { items: outreach, count: outreach.length },
      total: deals.length + sellers.length + outreach.length
    })
  } catch (error) {
    console.error('GET /api/search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
