import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyEventAccess } from '@/lib/phase5-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const updateEventSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  reminder: z.string().optional().nullable(),
})

// GET /api/events/[id] — event detail
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, event } = await verifyEventAccess(id)
  if (error) return error

  return NextResponse.json({ event })
}

// PATCH /api/events/[id] — update event
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, event, workspaceMember } = await verifyEventAccess(id)
  if (error) return error

  const userId = session!.user.id
  const isCreator = event!.creatorId === userId
  const isOwnerOrAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isCreator && !isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Only the creator or workspace admin can edit this event' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const parsed = updateEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const data = parsed.data

  const updated = await db.event.update({
    where: { id },
    data: {
      ...(data.title ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.location !== undefined ? { location: data.location?.trim() || null } : {}),
      ...(data.startAt ? { startAt: new Date(data.startAt) } : {}),
      ...(data.endAt ? { endAt: new Date(data.endAt) } : {}),
      ...(data.allDay !== undefined ? { allDay: data.allDay } : {}),
      ...(data.reminder !== undefined ? { reminder: data.reminder } : {}),
    },
    include: {
      creator: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
      attendees: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
    },
  })

  return NextResponse.json({ event: updated })
}

// DELETE /api/events/[id] — delete event
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, event, workspaceMember } = await verifyEventAccess(id)
  if (error) return error

  const userId = session!.user.id
  const isCreator = event!.creatorId === userId
  const isOwnerOrAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isCreator && !isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Only the creator or workspace admin can delete this event' },
      { status: 403 }
    )
  }

  await db.event.delete({ where: { id } })

  return NextResponse.json({ success: true, message: 'Event deleted' })
}
