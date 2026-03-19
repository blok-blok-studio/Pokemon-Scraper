import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = parseInt(id)
    if (isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const deal = await prisma.cardListing.findUnique({ where: { id: numId }, select: { cardName: true } })
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!deal.cardName) return NextResponse.json([])

    const history = await prisma.priceHistory.findMany({
      where: { cardName: deal.cardName },
      orderBy: { recordedAt: 'desc' },
      take: 20
    })

    return NextResponse.json(history)
  } catch (error) {
    console.error('GET /api/deals/[id]/prices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
