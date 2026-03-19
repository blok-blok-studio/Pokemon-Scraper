import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function parseId(id: string): number | null {
  const parsed = parseInt(id)
  return isNaN(parsed) ? null : parsed
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = parseId(id)
    if (numId === null) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const deal = await prisma.cardListing.findUnique({
      where: { id: numId },
      include: { seller: true }
    })
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(deal)
  } catch (error) {
    console.error('GET /api/deals/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = parseId(id)
    if (numId === null) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const data = await request.json()
    const VALID_STAGES = ['new', 'reviewing', 'approved', 'purchased', 'passed']
    if (data.pipelineStage !== undefined && !VALID_STAGES.includes(data.pipelineStage)) {
      return NextResponse.json({ error: `Invalid pipelineStage` }, { status: 400 })
    }
    const updated = await prisma.cardListing.update({
      where: { id: numId },
      data: { pipelineStage: data.pipelineStage }
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/deals/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
