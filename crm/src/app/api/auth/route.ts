import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }

    const valid = await verifyPassword(password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    await createSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
