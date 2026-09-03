import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'

// GET /api/notifications — list current user's notifications (with cursor pagination)
export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const cursor = searchParams.get('cursor')

  const whereClause = {
    userId,
    ...(workspaceId ? { workspaceId } : {}),
    ...(unreadOnly ? { read: false } : {}),
  }

  const [notifications, totalUnread] = await Promise.all([
    db.notification.findMany({
      where: whereClause,
      take: limit + 1,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true, username: true, image: true } },
        workspace: { select: { id: true, name: true } },
      },
    }),
    db.notification.count({
      where: {
        userId,
        read: false,
        ...(workspaceId ? { workspaceId } : {}),
      },
    }),
  ])

  let nextCursor: string | null = null
  if (notifications.length > limit) {
    const nextItem = notifications.pop()
    nextCursor = nextItem?.id || null
  }

  return NextResponse.json({
    notifications,
    nextCursor,
    unreadCount: totalUnread,
  })
}
