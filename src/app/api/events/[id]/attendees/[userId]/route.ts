import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyEventAccess } from '@/lib/phase5-auth'

type Params = { params: Promise<{ id: string; userId: string }> }

// DELETE /api/events/[id]/attendees/[userId] — remove attendee
export async function DELETE(_req: Request, { params }: Params) {
  const { id, userId } = await params
  const { error, session, event, workspaceMember } = await verifyEventAccess(id)
  if (error) return error

  const currentUserId = session!.user.id
  const isSelf = userId === currentUserId
  const isCreator = event!.creatorId === currentUserId
  const isOwnerOrAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isSelf && !isCreator && !isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Only the creator, admin, or the attendee themselves can remove attendance' },
      { status: 403 }
    )
  }

  await db.eventAttendee.deleteMany({
    where: {
      eventId: id,
      userId,
    },
  })

  return NextResponse.json({ success: true, message: 'Attendee removed' })
}
