import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const outreach = await prisma.outreachLog.findUnique({
    where: { id: parseInt(params.id) },
    include: { seller: true }
  })
  if (!outreach) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(outreach)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const data: any = {}
  if (body.pipelineStage !== undefined) data.pipelineStage = body.pipelineStage
  if (body.approved !== undefined) data.approved = body.approved
  if (body.sellerId !== undefined) data.sellerId = body.sellerId

  const updated = await prisma.outreachLog.update({
    where: { id: parseInt(params.id) },
    data,
    include: { seller: true }
  })
  return NextResponse.json(updated)
}
