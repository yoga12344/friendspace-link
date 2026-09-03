import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTaskAccess } from '@/lib/project-auth'
import { createNotification } from '@/lib/notifications'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
})

// GET /api/tasks/[id]/comments — list task comments
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error } = await verifyTaskAccess(id)
  if (error) return error

  const comments = await db.taskComment.findMany({
    where: { taskId: id },
    include: {
      author: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ comments })
}

// POST /api/tasks/[id]/comments — add comment to task
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, task } = await verifyTaskAccess(id)
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = createCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const comment = await db.taskComment.create({
    data: {
      taskId: id,
      authorId: userId,
      content: parsed.data.content.trim(),
    },
    include: {
      author: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
  })

  // Notify task creator and assignees (excluding author)
  const notifyUserIds = new Set<string>()
  if (task!.creatorId !== userId) notifyUserIds.add(task!.creatorId)
  task!.assignees.forEach((a) => {
    if (a.userId !== userId) notifyUserIds.add(a.userId)
  })

  for (const recipientId of notifyUserIds) {
    await createNotification({
      workspaceId: task!.workspaceId,
      recipientId,
      actorId: userId,
      type: 'TASK_COMMENT',
      title: 'New Comment on Task',
      body: `${session!.user.name}: "${parsed.data.content.slice(0, 80)}"`,
      link: task!.projectId ? `/projects/${task!.projectId}?task=${id}` : `/tasks`,
      entityType: 'task',
      entityId: id,
    })
  }

  // Create Activity feed event
  await createActivity({
    workspaceId: task!.workspaceId,
    actorId: userId,
    type: 'TASK_COMMENT',
    entityType: 'task',
    entityId: id,
    entityName: task!.title,
    projectId: task!.projectId,
  })

  return NextResponse.json({ comment }, { status: 201 })
}
