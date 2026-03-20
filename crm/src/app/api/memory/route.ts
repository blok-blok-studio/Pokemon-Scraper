import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const importance = searchParams.get('importance')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

    const where: any = {}
    if (category) where.category = category
    if (importance) where.importance = importance
    if (search) {
      where.content = { contains: search, mode: 'insensitive' }
    }

    const memories = await prisma.agentMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Stats
    const [total, byCategory, byImportance] = await Promise.all([
      prisma.agentMemory.count(),
      prisma.agentMemory.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } } }),
      prisma.agentMemory.groupBy({ by: ['importance'], _count: true }),
    ])

    return NextResponse.json({
      memories,
      stats: {
        total,
        byCategory: byCategory.map(c => ({ category: c.category, count: c._count })),
        byImportance: byImportance.map(i => ({ importance: i.importance, count: i._count })),
      }
    })
  } catch (error) {
    console.error('GET /api/memory error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
