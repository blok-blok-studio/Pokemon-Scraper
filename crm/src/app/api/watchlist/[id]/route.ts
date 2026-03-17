import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const data: any = {}
  if (body.cardName !== undefined) data.cardName = body.cardName
  if (body.setName !== undefined) data.setName = body.setName
  if (body.maxPrice !== undefined) data.maxPrice = body.maxPrice
  if (body.active !== undefined) data.active = body.active

  const item = await prisma.watchlist.update({
    where: { id: params.id },
    data
  })
  return NextResponse.json(item)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.watchlist.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}
