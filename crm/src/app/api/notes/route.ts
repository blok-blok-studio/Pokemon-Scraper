import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId required' }, { status: 400 })
    }

    const parsed = parseInt(entityId)
    if (isNaN(parsed)) return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 })

    const notes = await prisma.note.findMany({
      where: { entityType, entityId: parsed },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(notes)
  } catch (error) {
    console.error('GET /api/notes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { body, entityType, entityId } = await request.json()

    if (!body || !entityType || entityId === undefined) {
      return NextResponse.json({ error: 'body, entityType, and entityId required' }, { status: 400 })
    }

    const numEntityId = typeof entityId === 'string' ? parseInt(entityId) : entityId
    if (isNaN(numEntityId)) {
      return NextResponse.json({ error: 'Invalid entityId' }, { status: 400 })
    }

    const note = await prisma.note.create({
      data: { body, entityType, entityId: numEntityId }
    })
    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('POST /api/notes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
