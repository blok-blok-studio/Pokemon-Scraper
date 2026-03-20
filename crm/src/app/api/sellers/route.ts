import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const type = searchParams.get('type')
    const hasTrust = searchParams.get('hasTrust')
    const hasEmail = searchParams.get('hasEmail')
    const minListings = searchParams.get('minListings')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (type) where.type = type
    if (hasTrust === 'true') where.trustScore = { not: null }
    if (hasEmail === 'true') where.contactEmail = { not: null }

    if (minListings) {
      where.listings = { some: {} }
    }

    const validSorts: Record<string, any> = {
      createdAt: { createdAt: sortDir },
      name: { name: sortDir },
      trust: { trustScore: sortDir },
      listings: { listings: { _count: sortDir } },
    }

    const sellers = await prisma.seller.findMany({
      where,
      orderBy: validSorts[sortBy] || { createdAt: 'desc' },
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
