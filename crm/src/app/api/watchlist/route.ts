import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.watchlist.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
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
}
