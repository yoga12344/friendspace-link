import { db } from '@/lib/db'
import { emitSocketEvent } from '@/lib/socket-broadcast'

export interface CreateActivityParams {
  workspaceId: string
  actorId: string
  type: string
  entityType: string
  entityId?: string | null
  entityName?: string | null
  projectId?: string | null
  metadata?: any
}

export async function createActivity(params: CreateActivityParams) {
  const {
    workspaceId,
    actorId,
    type,
    entityType,
    entityId,
    entityName,
    projectId,
    metadata,
  } = params

  // Verify actor belongs to workspace
  const member = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: actorId,
      },
    },
  })

  if (!member) {
    // Actor not in workspace, skip activity
    return null
  }

  // If projectId is given, verify it belongs to this workspace
  if (projectId) {
    const proj = await db.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    })
    if (!proj || proj.workspaceId !== workspaceId) {
      return null
    }
  }

  // Create ActivityEvent in database
  const activity = await db.activityEvent.create({
    data: {
      workspaceId,
      actorId,
      type,
      entityType,
      entityId: entityId || null,
      entityName: entityName?.trim() || null,
      projectId: projectId || null,
      metadata: metadata || undefined,
    },
    include: {
      actor: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
    },
  })

  // Broadcast real-time activity event to workspace room
  await emitSocketEvent(`workspace:${workspaceId}`, 'activity:new', activity)

  return activity
}
