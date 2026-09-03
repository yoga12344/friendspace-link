import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, verifyWorkspaceMember } from '@/lib/workspace-auth'

// GET /api/activity — list chronological workspace/project activity
export async function GET(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const projectId = searchParams.get('projectId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const cursor = searchParams.get('cursor')

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const { error: wsError } = await verifyWorkspaceMember(workspaceId)
  if (wsError) return wsError

  if (projectId) {
    const proj = await db.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    })
    if (!proj || proj.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Project does not belong to this workspace' },
        { status: 400 }
      )
    }
  }

  const activities = await db.activityEvent.findMany({
    where: {
      workspaceId,
      ...(projectId ? { projectId } : {}),
    },
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      actor: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
    },
  })

  let nextCursor: string | null = null
  if (activities.length > limit) {
    const nextItem = activities.pop()
    nextCursor = nextItem?.id || null
  }

  return NextResponse.json({
    activities,
    nextCursor,
  })
}
