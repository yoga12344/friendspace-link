import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'

// GET /api/users/search?q=... — search users
export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  const currentUserId = session!.user.id

  const users = await db.user.findMany({
    where: {
      id: { not: currentUserId },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      status: true,
    },
    take: 10,
  })

  return NextResponse.json({ users })
}
