import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200)

    const where: any = {}
    if (stage) where.pipelineStage = stage

    const outreach = await prisma.outreachLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: limit,
      include: { seller: true }
    })
    return NextResponse.json(outreach)
  } catch (error) {
    console.error('GET /api/outreach error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, pipelineStage, approved } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const numId = typeof id === 'string' ? parseInt(id) : id
    if (isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const data: any = {}
    if (pipelineStage !== undefined) data.pipelineStage = pipelineStage
    if (approved !== undefined) data.approved = approved

    const updated = await prisma.outreachLog.update({ where: { id: numId }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/outreach error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
