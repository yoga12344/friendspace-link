import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTaskAccess } from '@/lib/project-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'
import { createNotification } from '@/lib/notifications'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const assignSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
})

// POST /api/tasks/[id]/assignees — assign user(s) to task
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, task } = await verifyTaskAccess(id)
  if (error) return error

  const body = await req.json()
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { userIds } = parsed.data

  // SECURITY: Ensure all assigned users belong to the task's workspace!
  const validMembers = await db.workspaceMember.findMany({
    where: {
      workspaceId: task!.workspaceId,
      userId: { in: userIds },
    },
    select: { userId: true },
  })

  const validUserIds = new Set(validMembers.map((m) => m.userId))
  const invalidUsers = userIds.filter((uId) => !validUserIds.has(uId))
  if (invalidUsers.length > 0) {
    return NextResponse.json(
      { error: 'Cannot assign users who are not members of this workspace' },
      { status: 400 }
    )
  }

  // Filter out users already assigned
  const existingAssigneeIds = new Set(task!.assignees.map((a) => a.userId))
  const newAssigneeIds = userIds.filter((uId) => !existingAssigneeIds.has(uId))

  if (newAssigneeIds.length === 0) {
    return NextResponse.json({ message: 'All specified users are already assigned' })
  }

  await db.taskAssignee.createMany({
    data: newAssigneeIds.map((uId) => ({
      taskId: id,
      userId: uId,
    })),
  })

  // Broadcast assignment
  await emitSocketEvent(`workspace:${task!.workspaceId}`, 'task.assigned', {
    taskId: id,
    assignedUserIds: newAssigneeIds,
  })

  // Create notifications for each newly assigned user
  for (const uId of newAssigneeIds) {
    await createNotification({
      workspaceId: task!.workspaceId,
      recipientId: uId,
      actorId: session!.user.id,
      type: 'TASK_ASSIGNED',
      title: 'Task Assigned',
      body: `You were assigned to "${task!.title}"`,
      link: task!.projectId ? `/projects/${task!.projectId}?task=${id}` : `/tasks`,
      entityType: 'task',
      entityId: id,
    })
  }

  // Create Activity feed event
  await createActivity({
    workspaceId: task!.workspaceId,
    actorId: session!.user.id,
    type: 'TASK_ASSIGNED',
    entityType: 'task',
    entityId: id,
    entityName: task!.title,
    projectId: task!.projectId,
    metadata: { assignedUserIds: newAssigneeIds },
  })

  return NextResponse.json({ success: true, assignedCount: newAssigneeIds.length })
}
