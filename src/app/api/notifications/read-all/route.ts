import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/workspace-auth'
import { markAllNotificationsAsRead } from '@/lib/notifications'

// POST /api/notifications/read-all — mark all notifications as read for current user
export async function POST(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  let workspaceId: string | undefined

  try {
    const body = await req.json()
    if (body?.workspaceId) workspaceId = body.workspaceId
  } catch {
    // optional body
  }

  await markAllNotificationsAsRead(userId, workspaceId)

  return NextResponse.json({ success: true, message: 'All notifications marked as read' })
}
