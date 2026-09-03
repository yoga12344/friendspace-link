import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTaskAccess } from '@/lib/project-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const updateTaskSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  projectId: z.string().optional().nullable(),
})

// GET /api/tasks/[id] — task details
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, task } = await verifyTaskAccess(id)
  if (error) return error

  return NextResponse.json({ task })
}

// PATCH /api/tasks/[id] — update task
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, task } = await verifyTaskAccess(id)
  if (error) return error

  const userId = session!.user.id

  const body = await req.json()
  const parsed = updateTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const data = parsed.data

  // Calculate completedAt if status changes
  let completedAtUpdate = undefined
  if (data.status) {
    if (data.status === 'COMPLETED' && task!.status !== 'COMPLETED') {
      completedAtUpdate = new Date()
    } else if (data.status !== 'COMPLETED' && task!.status === 'COMPLETED') {
      completedAtUpdate = null
    }
  }

  const updated = await db.task.update({
    where: { id },
    data: {
      ...(data.title ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.startDate !== undefined
        ? { startDate: data.startDate ? new Date(data.startDate) : null }
        : {}),
      ...(data.dueDate !== undefined
        ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
        : {}),
      ...(completedAtUpdate !== undefined ? { completedAt: completedAtUpdate } : {}),
      ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
    },
    include: {
      project: { select: { id: true, name: true, icon: true, color: true } },
      creator: { select: { id: true, name: true, username: true, image: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
      tags: true,
      checklists: { orderBy: { order: 'asc' } },
      _count: { select: { comments: true } },
    },
  })

  // Broadcast real-time update
  const eventName = updated.status === 'COMPLETED' ? 'task.completed' : 'task.updated'
  await emitSocketEvent(`workspace:${task!.workspaceId}`, eventName, {
    task: updated,
  })

  // Create Activity feed event if status changed
  if (data.status && data.status !== task!.status) {
    await createActivity({
      workspaceId: task!.workspaceId,
      actorId: userId,
      type: updated.status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_STATUS_CHANGED',
      entityType: 'task',
      entityId: updated.id,
      entityName: updated.title,
      projectId: updated.projectId,
      metadata: { fromStatus: task!.status, toStatus: updated.status },
    })
  }

  return NextResponse.json({ task: updated })
}

// DELETE /api/tasks/[id] — delete task
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, task } = await verifyTaskAccess(id)
  if (error) return error

  await db.task.delete({ where: { id } })

  await emitSocketEvent(`workspace:${task!.workspaceId}`, 'task.deleted', {
    taskId: id,
    projectId: task!.projectId,
  })

  return NextResponse.json({ success: true, message: 'Task deleted' })
}
