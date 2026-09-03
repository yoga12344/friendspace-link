import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'

type Params = { params: Promise<{ token: string }> }

// POST /api/invitations/[token]/accept — authenticated user accepts invitation
export async function POST(_req: Request, { params }: Params) {
  const { token } = await params
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { workspace: true },
  })

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (invitation.status !== 'PENDING') {
    return NextResponse.json(
      { error: `This invitation has already been ${invitation.status.toLowerCase()}` },
      { status: 400 }
    )
  }

  if (new Date() > invitation.expiresAt) {
    await db.invitation.update({
      where: { token },
      data: { status: 'EXPIRED' },
    })
    return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
  }

  // If invitation was sent to a specific email, verify the current user matches that email
  if (invitation.email && invitation.email.toLowerCase() !== session!.user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: `This invitation was sent to ${invitation.email}. Please sign in with that account.` },
      { status: 403 }
    )
  }

  // Prevent duplicate membership
  const existingMember = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    },
  })

  if (existingMember) {
    // Mark invitation accepted anyway
    await db.invitation.update({
      where: { token },
      data: { status: 'ACCEPTED' },
    })
    return NextResponse.json({
      message: 'You are already a member of this workspace',
      workspace: invitation.workspace,
    })
  }

  // Transaction: create workspace member and mark invitation accepted
  const [member] = await db.$transaction([
    db.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId,
        role: 'MEMBER',
      },
    }),
    db.invitation.update({
      where: { token },
      data: { status: 'ACCEPTED' },
    }),
  ])

  return NextResponse.json({
    success: true,
    workspace: invitation.workspace,
    member,
  })
}
