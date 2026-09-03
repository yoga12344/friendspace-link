import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyWorkspaceRole } from '@/lib/workspace-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string; userId: string }> }

const roleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
})

// PATCH /api/workspaces/[id]/members/[userId] — change role (Owner only, cannot change owner)
export async function PATCH(req: Request, { params }: Params) {
  const { id, userId } = await params
  const { error, member, session } = await verifyWorkspaceRole(id, 'OWNER')
  if (error) return error

  if (userId === session!.user.id) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
  }

  // Prevent demoting another owner
  const target = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }
  if (target.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = roleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updated = await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: id, userId } },
    data: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, username: true } } },
  })

  return NextResponse.json({ member: updated })
}

// DELETE /api/workspaces/[id]/members/[userId] — remove member (Admin+ can remove Members; Owner can remove anyone)
export async function DELETE(_req: Request, { params }: Params) {
  const { id, userId } = await params
  const { error, member, session } = await verifyWorkspaceRole(id, 'ADMIN')
  if (error) return error

  if (userId === session!.user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }

  const target = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })
  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Admins cannot remove other Admins or Owners
  if (member!.role === 'ADMIN' && target.role !== 'MEMBER') {
    return NextResponse.json(
      { error: 'Admins can only remove regular members' },
      { status: 403 }
    )
  }

  if (target.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot remove the workspace owner' }, { status: 400 })
  }

  await db.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId: id, userId } },
  })

  return NextResponse.json({ success: true })
}
