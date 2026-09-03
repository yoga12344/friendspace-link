import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function verifyProjectAccess(projectId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
      project: null,
      workspaceMember: null,
    }
  }

  const userId = session.user.id

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: true,
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, image: true, status: true },
          },
        },
      },
    },
  })

  if (!project) {
    return {
      error: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
      session: null,
      project: null,
      workspaceMember: null,
    }
  }

  // Verify user is a member of the workspace
  const workspaceMember = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: project.workspaceId,
        userId,
      },
    },
  })

  if (!workspaceMember) {
    return {
      error: NextResponse.json(
        { error: 'You do not have access to this workspace or its projects' },
        { status: 403 }
      ),
      session: null,
      project: null,
      workspaceMember: null,
    }
  }

  return {
    error: null,
    session,
    project,
    workspaceMember,
  }
}

export async function verifyTaskAccess(taskId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
      task: null,
      workspaceMember: null,
    }
  }

  const userId = session.user.id

  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      assignees: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
      tags: true,
      checklists: { orderBy: { order: 'asc' } },
      attachments: true,
      comments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, username: true, image: true } },
        },
      },
    },
  })

  if (!task) {
    return {
      error: NextResponse.json({ error: 'Task not found' }, { status: 404 }),
      session: null,
      task: null,
      workspaceMember: null,
    }
  }

  // Verify user is a member of the task's workspace
  const workspaceMember = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: task.workspaceId,
        userId,
      },
    },
  })

  if (!workspaceMember) {
    return {
      error: NextResponse.json(
        { error: 'You do not have access to this workspace or its tasks' },
        { status: 403 }
      ),
      session: null,
      task: null,
      workspaceMember: null,
    }
  }

  return {
    error: null,
    session,
    task,
    workspaceMember,
  }
}
