import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyProjectAccess } from '@/lib/project-auth'

type Params = { params: Promise<{ id: string; userId: string }> }

// DELETE /api/projects/[id]/members/[userId] — remove project member
export async function DELETE(_req: Request, { params }: Params) {
  const { id, userId } = await params
  const { error, session, project, workspaceMember } = await verifyProjectAccess(id)
  if (error) return error

  const currentUserId = session!.user.id
  const isSelf = userId === currentUserId
  const isCreator = project!.creatorId === currentUserId
  const callerProjectMember = project!.members.find((m) => m.userId === currentUserId)
  const isProjectAdmin = callerProjectMember?.role === 'ADMIN'
  const isWorkspaceAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  // Cannot remove creator
  if (userId === project!.creatorId) {
    return NextResponse.json({ error: 'Cannot remove the project creator' }, { status: 400 })
  }

  // Must be self leaving, or admin
  if (!isSelf && !isCreator && !isProjectAdmin && !isWorkspaceAdmin) {
    return NextResponse.json(
      { error: 'You do not have permission to remove this member' },
      { status: 403 }
    )
  }

  const existing = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId } },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Member not found in project' }, { status: 404 })
  }

  await db.projectMember.delete({
    where: { projectId_userId: { projectId: id, userId } },
  })

  return NextResponse.json({ success: true, message: 'Member removed from project' })
}
