import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100') || 100, 1), 500)
    const grade = searchParams.get('grade')
    const stage = searchParams.get('stage')
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const hasMarketPrice = searchParams.get('hasMarketPrice')
    const sortBy = searchParams.get('sortBy') || 'foundAt'
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'

    const where: any = {}
    if (grade) where.dealGrade = grade
    if (stage) where.pipelineStage = stage
    if (source) where.source = source

    // Text search across card name, title, set name
    if (search) {
      where.OR = [
        { cardName: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { setName: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    // Filter to only items with market prices
    if (hasMarketPrice === 'true') {
      where.tcgMarketPrice = { not: null }
    }

    // Sortable columns
    const validSorts: Record<string, string> = {
      foundAt: 'foundAt',
      price: 'price',
      discount: 'discountPercent',
      market: 'tcgMarketPrice',
      grade: 'dealGrade',
    }
    const orderField = validSorts[sortBy] || 'foundAt'

    const deals = await prisma.cardListing.findMany({
      where,
      orderBy: { [orderField]: sortDir },
      take: limit,
      include: { seller: true }
    })

    return NextResponse.json(deals)
  } catch (error) {
    console.error('GET /api/deals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, pipelineStage } = await request.json()

    const VALID_STAGES = ['new', 'reviewing', 'approved', 'purchased', 'passed']
    if (pipelineStage !== undefined && !VALID_STAGES.includes(pipelineStage)) {
      return NextResponse.json({ error: `Invalid pipelineStage. Must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const numId = typeof id === 'string' ? parseInt(id) : id
    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const updated = await prisma.cardListing.update({
      where: { id: numId },
      data: { pipelineStage }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/deals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
