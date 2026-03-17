import { compare } from 'bcryptjs'
import { cookies } from 'next/headers'

const SESSION_NAME = 'crm_session'
const SESSION_VALUE = 'authenticated'

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.CRM_PASSWORD_HASH?.trim()
  if (!hash) return false
  return compare(password, hash)
}

export async function createSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_NAME, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })
}

export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_NAME)
  return session?.value === SESSION_VALUE
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_NAME)
}
