import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await prisma.cardListing.findUnique({
    where: { id: parseInt(id) },
    include: { seller: true }
  })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(deal)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await request.json()

  const updated = await prisma.cardListing.update({
    where: { id: parseInt(id) },
    data: { pipelineStage: data.pipelineStage }
  })

  return NextResponse.json(updated)
}
