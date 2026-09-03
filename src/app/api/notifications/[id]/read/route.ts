import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/workspace-auth'
import { markNotificationAsRead } from '@/lib/notifications'

type Params = { params: Promise<{ id: string }> }

// POST /api/notifications/[id]/read — mark single notification as read
export async function POST(_req: Request, { params }: Params) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { id } = await params

  const updated = await markNotificationAsRead(id, userId)
  if (!updated) {
    return NextResponse.json(
      { error: 'Notification not found or access denied' },
      { status: 404 }
    )
  }

  return NextResponse.json({ notification: updated })
}
