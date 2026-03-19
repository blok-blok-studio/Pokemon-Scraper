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

    const seller = await prisma.seller.findUnique({
      where: { id: numId },
      include: {
        listings: { orderBy: { foundAt: 'desc' }, take: 20 },
        outreach: { orderBy: { sentAt: 'desc' }, take: 20 }
      }
    })
    if (!seller) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(seller)
  } catch (error) {
    console.error('GET /api/sellers/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = parseId(id)
    if (numId === null) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const body = await request.json()
    // Whitelist updatable fields to prevent mass assignment
    const allowedFields = ['name', 'type', 'notes'] as const
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field]
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    const updated = await prisma.seller.update({
      where: { id: numId },
      data
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/sellers/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
