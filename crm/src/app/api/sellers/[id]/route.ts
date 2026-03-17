import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const seller = await prisma.seller.findUnique({
    where: { id: parseInt(id) },
    include: {
      listings: { orderBy: { foundAt: 'desc' }, take: 20 },
      outreach: { orderBy: { sentAt: 'desc' }, take: 20 }
    }
  })
  if (!seller) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(seller)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await request.json()
  const updated = await prisma.seller.update({
    where: { id: parseInt(id) },
    data
  })
  return NextResponse.json(updated)
}
