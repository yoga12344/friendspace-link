import { db } from '@/lib/db'
import { emitSocketEvent } from '@/lib/socket-broadcast'
import { NotificationType } from '@prisma/client'

export interface CreateNotificationParams {
  workspaceId?: string | null
  recipientId: string
  actorId?: string | null
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  entityType?: string | null
  entityId?: string | null
}

export async function createNotification(params: CreateNotificationParams) {
  const {
    workspaceId,
    recipientId,
    actorId,
    type,
    title,
    body,
    link,
    entityType,
    entityId,
  } = params

  // Never notify self
  if (actorId && actorId === recipientId) {
    return null
  }

  // If workspaceId is provided, verify recipient is an active member
  if (workspaceId) {
    const isMember = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: recipientId,
        },
      },
    })
    if (!isMember) {
      // Recipient is not a member of this workspace
      return null
    }
  }

  // Check recipient notification preferences if set
  const prefs = await db.notificationPreference.findUnique({
    where: { userId: recipientId },
  })

  if (prefs) {
    if (type === 'TASK_ASSIGNED' && !prefs.taskAssignments) return null
    if (type === 'TASK_COMMENT' && !prefs.taskAssignments) return null
    if (type === 'TASK_DUE' && !prefs.taskDue) return null
    if (type === 'MESSAGE' && !prefs.messages) return null
    if (type === 'MENTION' && !prefs.mentions) return null
    if ((type === 'EVENT_INVITE' || type === 'EVENT_UPDATED') && !prefs.events) return null
    if (type === 'FILE_SHARED' && !prefs.fileShared) return null
    if ((type === 'DOCUMENT_SHARED' || type === 'DOCUMENT_UPDATED') && !prefs.documentUpdated) return null
  }

  // Create notification in database
  const notification = await db.notification.create({
    data: {
      workspaceId: workspaceId || null,
      userId: recipientId,
      actorId: actorId || null,
      type,
      title: title.trim(),
      body: body?.trim() || null,
      link: link || null,
      entityType: entityType || null,
      entityId: entityId || null,
    },
    include: {
      actor: { select: { id: true, name: true, username: true, image: true } },
      workspace: { select: { id: true, name: true } },
    },
  })

  // Broadcast real-time event to the specific recipient user room
  await emitSocketEvent(`user:${recipientId}`, 'notification:new', notification)

  return notification
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  const notif = await db.notification.findUnique({
    where: { id: notificationId },
  })

  if (!notif || notif.userId !== userId) {
    return null
  }

  const updated = await db.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  })

  await emitSocketEvent(`user:${userId}`, 'notification:read', {
    id: notificationId,
  })

  return updated
}

export async function markAllNotificationsAsRead(userId: string, workspaceId?: string) {
  await db.notification.updateMany({
    where: {
      userId,
      read: false,
      ...(workspaceId ? { workspaceId } : {}),
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  })

  await emitSocketEvent(`user:${userId}`, 'notification:read-all', {
    workspaceId,
  })

  return { success: true }
}
