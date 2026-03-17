import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType and entityId required' }, { status: 400 })
  }

  const notes = await prisma.note.findMany({
    where: { entityType, entityId: parseInt(entityId) },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(notes)
}

export async function POST(request: NextRequest) {
  const { body, entityType, entityId } = await request.json()

  if (!body || !entityType || !entityId) {
    return NextResponse.json({ error: 'body, entityType, and entityId required' }, { status: 400 })
  }

  const note = await prisma.note.create({
    data: { body, entityType, entityId }
  })
  return NextResponse.json(note, { status: 201 })
}
