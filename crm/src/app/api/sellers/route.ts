import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const sellers = await prisma.seller.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { listings: true, outreach: true } }
    }
  })
  return NextResponse.json(sellers)
}

export async function POST(request: NextRequest) {
  const data = await request.json()
  const seller = await prisma.seller.create({
    data: {
      name: data.name,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      type: data.type || null,
    }
  })
  return NextResponse.json(seller, { status: 201 })
}
