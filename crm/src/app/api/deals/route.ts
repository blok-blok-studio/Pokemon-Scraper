import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
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
}

export async function PATCH(request: NextRequest) {
  const { id, pipelineStage } = await request.json()

  const updated = await prisma.cardListing.update({
    where: { id },
    data: { pipelineStage }
  })

  return NextResponse.json(updated)
}
