import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyProjectAccess } from '@/lib/project-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const updateProjectSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(4).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
})

// GET /api/projects/[id] — project details with stats
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, project } = await verifyProjectAccess(id)
  if (error) return error

  // Calculate task statistics by status
  const taskCounts = await db.task.groupBy({
    by: ['status'],
    where: { projectId: id },
    _count: { id: true },
  })

  const stats = {
    total: 0,
    BACKLOG: 0,
    TODO: 0,
    IN_PROGRESS: 0,
    REVIEW: 0,
    COMPLETED: 0,
  }

  for (const item of taskCounts) {
    stats[item.status] = item._count.id
    stats.total += item._count.id
  }

  return NextResponse.json({
    project: {
      ...project,
      stats: {
        ...stats,
        progress:
          stats.total > 0
            ? Math.round((stats.COMPLETED / stats.total) * 100)
            : 0,
      },
    },
  })
}

// PATCH /api/projects/[id] — update project
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, project, workspaceMember } = await verifyProjectAccess(id)
  if (error) return error

  const userId = session!.user.id

  // Verify permission: project creator, project ADMIN member, or workspace OWNER/ADMIN
  const isCreator = project!.creatorId === userId
  const projectMember = project!.members.find((m) => m.userId === userId)
  const isProjectAdmin = projectMember?.role === 'ADMIN'
  const isWorkspaceAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isCreator && !isProjectAdmin && !isWorkspaceAdmin) {
    return NextResponse.json(
      { error: 'You do not have permission to update this project' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const parsed = updateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const data = parsed.data

  const updated = await db.project.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.startDate !== undefined
        ? { startDate: data.startDate ? new Date(data.startDate) : null }
        : {}),
      ...(data.dueDate !== undefined
        ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
        : {}),
    },
    include: {
      creator: { select: { id: true, name: true, username: true, image: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
    },
  })

  return NextResponse.json({ project: updated })
}

// DELETE /api/projects/[id] — delete project
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, project, workspaceMember } = await verifyProjectAccess(id)
  if (error) return error

  const userId = session!.user.id
  const isCreator = project!.creatorId === userId
  const isWorkspaceOwner = workspaceMember!.role === 'OWNER'

  if (!isCreator && !isWorkspaceOwner) {
    return NextResponse.json(
      { error: 'Only the project creator or workspace owner can delete this project' },
      { status: 403 }
    )
  }

  await db.project.delete({ where: { id } })

  return NextResponse.json({ success: true, message: 'Project deleted' })
}
