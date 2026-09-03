import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyEventAccess } from '@/lib/phase5-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const addAttendeeSchema = z.object({
  userId: z.string().min(1),
})

// POST /api/events/[id]/attendees — invite attendee
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, event, workspaceMember } = await verifyEventAccess(id)
  if (error) return error

  const userId = session!.user.id
  const isCreator = event!.creatorId === userId
  const isOwnerOrAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isCreator && !isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Only the event creator or admin can manage attendees' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const parsed = addAttendeeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const targetUserId = parsed.data.userId

  // Verify target is workspace member
  const targetMember = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: event!.workspaceId,
        userId: targetUserId,
      },
    },
  })

  if (!targetMember) {
    return NextResponse.json(
      { error: 'Cannot invite user outside this workspace' },
      { status: 400 }
    )
  }

  const attendee = await db.eventAttendee.upsert({
    where: {
      eventId_userId: {
        eventId: id,
        userId: targetUserId,
      },
    },
    update: {},
    create: {
      eventId: id,
      userId: targetUserId,
      status: 'INVITED',
    },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  })

  return NextResponse.json({ attendee }, { status: 201 })
}
