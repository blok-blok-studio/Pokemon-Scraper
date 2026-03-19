import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200)
    const grade = searchParams.get('grade')
    const stage = searchParams.get('stage')
    const source = searchParams.get('source')

    const where: any = {}
    if (grade) where.dealGrade = grade
    if (stage) where.pipelineStage = stage
    if (source) where.source = source

    const deals = await prisma.cardListing.findMany({
      where,
      orderBy: { discountPercent: 'desc' },
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
