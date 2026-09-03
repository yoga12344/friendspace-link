import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, verifyWorkspaceMember } from '@/lib/workspace-auth'
import { createNotification } from '@/lib/notifications'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'

const createEventSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace is required'),
  projectId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(120),
  description: z.string().max(1000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  reminder: z.string().optional().nullable(),
  attendeeIds: z.array(z.string()).optional(),
})

// GET /api/events — list events and task deadlines in workspace
export async function GET(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const { error: wsError } = await verifyWorkspaceMember(workspaceId)
  if (wsError) return wsError

  const dateFilter = {
    ...(start && end
      ? {
          startAt: { gte: new Date(start) },
          endAt: { lte: new Date(end) },
        }
      : {}),
  }

  // Fetch real calendar events
  const events = await db.event.findMany({
    where: {
      workspaceId,
      ...dateFilter,
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
    orderBy: { startAt: 'asc' },
  })

  // Task -> Calendar: Fetch tasks with due dates in this workspace without duplicating DB records!
  const tasksWithDueDates = await db.task.findMany({
    where: {
      workspaceId,
      dueDate: { not: null },
      ...(start && end
        ? {
            dueDate: {
              gte: new Date(start),
              lte: new Date(end),
            },
          }
        : {}),
    },
    include: {
      project: { select: { id: true, name: true, icon: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
  })

  // Format task items as calendar items
  const taskCalendarItems = tasksWithDueDates.map((t) => ({
    id: `task-${t.id}`,
    taskId: t.id,
    isTask: true,
    title: t.title,
    startAt: t.dueDate,
    endAt: t.dueDate,
    status: t.status,
    priority: t.priority,
    project: t.project,
    assignees: t.assignees,
  }))

  return NextResponse.json({
    events,
    taskEvents: taskCalendarItems,
  })
}

// POST /api/events — create event in workspace
export async function POST(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = createEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const {
    workspaceId,
    projectId,
    title,
    description,
    location,
    startAt,
    endAt,
    allDay,
    reminder,
    attendeeIds,
  } = parsed.data

  const { error: wsError } = await verifyWorkspaceMember(workspaceId)
  if (wsError) return wsError

  // Validate that all attendeeIds belong to this workspace
  let validatedAttendeeIds: string[] = []
  if (attendeeIds && attendeeIds.length > 0) {
    const validMembers = await db.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: attendeeIds },
      },
      select: { userId: true },
    })
    validatedAttendeeIds = validMembers.map((m) => m.userId)
  }

  // Include creator as attendee automatically
  const allAttendeeIds = Array.from(new Set([userId, ...validatedAttendeeIds]))

  const event = await db.event.create({
    data: {
      workspaceId,
      projectId: projectId || null,
      creatorId: userId,
      title: title.trim(),
      description: description?.trim() || null,
      location: location?.trim() || null,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      allDay,
      reminder: reminder || null,
      attendees: {
        create: allAttendeeIds.map((aId) => ({
          userId: aId,
          status: aId === userId ? 'ACCEPTED' : 'INVITED',
        })),
      },
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

  // Notify invited attendees
  for (const aId of validatedAttendeeIds) {
    if (aId !== userId) {
      await createNotification({
        workspaceId,
        recipientId: aId,
        actorId: userId,
        type: 'EVENT_INVITE',
        title: 'Event Invitation',
        body: `You were invited to "${event.title}"`,
        link: `/calendar?event=${event.id}`,
        entityType: 'event',
        entityId: event.id,
      })
    }
  }

  // Create Activity feed event
  await createActivity({
    workspaceId,
    actorId: userId,
    type: 'EVENT_CREATED',
    entityType: 'event',
    entityId: event.id,
    entityName: event.title,
    projectId: event.projectId,
  })

  return NextResponse.json({ event }, { status: 201 })
}
