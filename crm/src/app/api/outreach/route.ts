import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')
  const limit = parseInt(searchParams.get('limit') || '50')

  const where: any = {}
  if (stage) where.pipelineStage = stage

  const outreach = await prisma.outreachLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: limit,
    include: { seller: true }
  })
  return NextResponse.json(outreach)
}

export async function PATCH(request: NextRequest) {
  const { id, pipelineStage, approved } = await request.json()
  const data: any = {}
  if (pipelineStage !== undefined) data.pipelineStage = pipelineStage
  if (approved !== undefined) data.approved = approved

  const updated = await prisma.outreachLog.update({ where: { id }, data })
  return NextResponse.json(updated)
}
