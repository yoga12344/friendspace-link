import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyProjectAccess } from '@/lib/project-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const addMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
})

// GET /api/projects/[id]/members — list project members
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, project } = await verifyProjectAccess(id)
  if (error) return error

  const members = await db.projectMember.findMany({
    where: { projectId: id },
    include: {
      user: {
        select: { id: true, name: true, username: true, image: true, status: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({ members })
}

// POST /api/projects/[id]/members — add members to project
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, project, workspaceMember } = await verifyProjectAccess(id)
  if (error) return error

  const userId = session!.user.id
  const isCreator = project!.creatorId === userId
  const callerProjectMember = project!.members.find((m) => m.userId === userId)
  const isProjectAdmin = callerProjectMember?.role === 'ADMIN'
  const isWorkspaceAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isCreator && !isProjectAdmin && !isWorkspaceAdmin) {
    return NextResponse.json(
      { error: 'You do not have permission to add members to this project' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const parsed = addMembersSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { userIds } = parsed.data

  // CRITICAL SECURITY: Ensure all added users belong to the workspace!
  const validWorkspaceMembers = await db.workspaceMember.findMany({
    where: {
      workspaceId: project!.workspaceId,
      userId: { in: userIds },
    },
    select: { userId: true },
  })

  const validUserIds = new Set(validWorkspaceMembers.map((m) => m.userId))
  const invalidUsers = userIds.filter((uId) => !validUserIds.has(uId))
  if (invalidUsers.length > 0) {
    return NextResponse.json(
      { error: 'Cannot add users who are not members of this workspace' },
      { status: 400 }
    )
  }

  // Filter out existing project members
  const existingMemberIds = new Set(project!.members.map((m) => m.userId))
  const newMemberIds = userIds.filter((uId) => !existingMemberIds.has(uId))

  if (newMemberIds.length === 0) {
    return NextResponse.json({ message: 'All specified users are already project members' })
  }

  await db.projectMember.createMany({
    data: newMemberIds.map((uId) => ({
      projectId: id,
      userId: uId,
      role: 'MEMBER',
    })),
  })

  return NextResponse.json({ success: true, addedCount: newMemberIds.length })
}
