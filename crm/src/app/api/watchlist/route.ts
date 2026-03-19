import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await prisma.watchlist.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('GET /api/watchlist error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { cardName, setName, maxPrice } = await request.json()

    if (!cardName) {
      return NextResponse.json({ error: 'cardName required' }, { status: 400 })
    }

    const item = await prisma.watchlist.create({
      data: {
        cardName,
        setName: setName || null,
        maxPrice: maxPrice || null,
      }
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('POST /api/watchlist error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
