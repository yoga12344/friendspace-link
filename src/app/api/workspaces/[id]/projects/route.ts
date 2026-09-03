import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyWorkspaceMember } from '@/lib/workspace-auth'
import { createNotification } from '@/lib/notifications'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(60),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(4).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).default('ACTIVE'),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  memberIds: z.array(z.string()).optional(),
})

// GET /api/workspaces/[id]/projects — list projects in workspace
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error } = await verifyWorkspaceMember(id)
  if (error) return error

  const projects = await db.project.findMany({
    where: { workspaceId: id },
    include: {
      creator: {
        select: { id: true, name: true, username: true, image: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      },
      _count: {
        select: { tasks: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Calculate completed tasks count for each project
  const projectsWithStats = await Promise.all(
    projects.map(async (p) => {
      const completedTasks = await db.task.count({
        where: { projectId: p.id, status: 'COMPLETED' },
      })
      return {
        ...p,
        stats: {
          totalTasks: p._count.tasks,
          completedTasks,
          progress:
            p._count.tasks > 0
              ? Math.round((completedTasks / p._count.tasks) * 100)
              : 0,
        },
      }
    })
  )

  return NextResponse.json({ projects: projectsWithStats })
}

// POST /api/workspaces/[id]/projects — create project in workspace
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session } = await verifyWorkspaceMember(id)
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, description, icon, color, status, startDate, dueDate, memberIds } = parsed.data

  // If memberIds are provided, verify they are members of this workspace
  let validatedMemberIds: string[] = []
  if (memberIds && memberIds.length > 0) {
    const validMembers = await db.workspaceMember.findMany({
      where: {
        workspaceId: id,
        userId: { in: memberIds },
      },
      select: { userId: true },
    })
    validatedMemberIds = validMembers.map((m) => m.userId)
  }

  // Ensure creator is included
  const allMemberIds = Array.from(new Set([userId, ...validatedMemberIds]))

  const project = await db.project.create({
    data: {
      workspaceId: id,
      creatorId: userId,
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || '📁',
      color: color || '#6366f1',
      status,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      members: {
        create: allMemberIds.map((mId) => ({
          userId: mId,
          role: mId === userId ? 'ADMIN' : 'MEMBER',
        })),
      },
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

  // Notify other added members
  for (const mId of validatedMemberIds) {
    if (mId !== userId) {
      await createNotification({
        workspaceId: id,
        recipientId: mId,
        actorId: userId,
        type: 'PROJECT_MEMBER_ADDED',
        title: 'Added to Project',
        body: `You were added to project "${project.name}"`,
        link: `/projects/${project.id}`,
        entityType: 'project',
        entityId: project.id,
      })
    }
  }

  // Create Activity feed event
  await createActivity({
    workspaceId: id,
    actorId: userId,
    type: 'PROJECT_CREATED',
    entityType: 'project',
    entityId: project.id,
    entityName: project.name,
    projectId: project.id,
  })

  return NextResponse.json({ project }, { status: 201 })
}
