import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function parseId(id: string): number | null {
  const parsed = parseInt(id)
  return isNaN(parsed) ? null : parsed
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseId(id)
    if (numId === null) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const outreach = await prisma.outreachLog.findUnique({
      where: { id: numId },
      include: { seller: true }
    })
    if (!outreach) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(outreach)
  } catch (error) {
    console.error('GET /api/outreach/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseId(id)
    if (numId === null) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const body = await request.json()
    const data: any = {}
    if (body.pipelineStage !== undefined) data.pipelineStage = body.pipelineStage
    if (body.approved !== undefined) data.approved = body.approved
    if (body.sellerId !== undefined) data.sellerId = body.sellerId

    const updated = await prisma.outreachLog.update({
      where: { id: numId },
      data,
      include: { seller: true }
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/outreach/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
