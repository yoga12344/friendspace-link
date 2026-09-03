import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyProjectAccess } from '@/lib/project-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'
import { createNotification } from '@/lib/notifications'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(120),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  tags: z.array(z.object({ name: z.string().min(1), color: z.string().optional() })).optional(),
})

// GET /api/projects/[id]/tasks — list tasks for a project
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const { error } = await verifyProjectAccess(id)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')
  const priorityFilter = searchParams.get('priority')
  const q = searchParams.get('q')?.toLowerCase()

  const tasks = await db.task.findMany({
    where: {
      projectId: id,
      ...(statusFilter ? { status: statusFilter as any } : {}),
      ...(priorityFilter ? { priority: priorityFilter as any } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
    include: {
      creator: {
        select: { id: true, name: true, username: true, image: true },
      },
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, username: true, image: true, status: true },
          },
        },
      },
      tags: true,
      checklists: { orderBy: { order: 'asc' } },
      _count: {
        select: { comments: true },
      },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ tasks })
}

// POST /api/projects/[id]/tasks — create task in project
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, project } = await verifyProjectAccess(id)
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = createTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { title, description, status, priority, startDate, dueDate, assigneeIds, tags } =
    parsed.data

  // SECURITY: Validate that all assigned users belong to the workspace!
  let validatedAssigneeIds: string[] = []
  if (assigneeIds && assigneeIds.length > 0) {
    const validMembers = await db.workspaceMember.findMany({
      where: {
        workspaceId: project!.workspaceId,
        userId: { in: assigneeIds },
      },
      select: { userId: true },
    })
    validatedAssigneeIds = validMembers.map((m) => m.userId)
  }

  const isCompleted = status === 'COMPLETED'

  const task = await db.task.create({
    data: {
      projectId: id,
      workspaceId: project!.workspaceId,
      creatorId: userId,
      title: title.trim(),
      description: description?.trim() || null,
      status,
      priority,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      completedAt: isCompleted ? new Date() : null,
      assignees: {
        create: validatedAssigneeIds.map((uId) => ({ userId: uId })),
      },
      tags: tags && tags.length > 0
        ? {
            create: tags.map((t) => ({ name: t.name.trim(), color: t.color || '#6366f1' })),
          }
        : undefined,
    },
    include: {
      creator: { select: { id: true, name: true, username: true, image: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
      tags: true,
      checklists: true,
      _count: { select: { comments: true } },
    },
  })

  // Broadcast real-time task creation
  await emitSocketEvent(`workspace:${project!.workspaceId}`, 'task.created', {
    task,
    projectId: id,
  })

  // Create notifications for assignees
  if (validatedAssigneeIds.length > 0) {
    for (const aId of validatedAssigneeIds) {
      await createNotification({
        workspaceId: project!.workspaceId,
        recipientId: aId,
        actorId: userId,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        body: `You were assigned to "${task.title}"`,
        link: `/projects/${id}?task=${task.id}`,
        entityType: 'task',
        entityId: task.id,
      })
    }
  }

  // Create Activity feed event
  await createActivity({
    workspaceId: project!.workspaceId,
    actorId: userId,
    type: 'TASK_CREATED',
    entityType: 'task',
    entityId: task.id,
    entityName: task.title,
    projectId: id,
  })

  return NextResponse.json({ task }, { status: 201 })
}
