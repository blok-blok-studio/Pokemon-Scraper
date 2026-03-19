import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sellers = await prisma.seller.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { listings: true, outreach: true } }
      }
    })
    return NextResponse.json(sellers)
  } catch (error) {
    console.error('GET /api/sellers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    if (!data.name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    const seller = await prisma.seller.create({
      data: {
        name: data.name,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        type: data.type || null,
      }
    })
    return NextResponse.json(seller, { status: 201 })
  } catch (error) {
    console.error('POST /api/sellers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
