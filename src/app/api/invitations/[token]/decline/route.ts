import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'

type Params = { params: Promise<{ token: string }> }

// POST /api/invitations/[token]/decline — decline an invitation
export async function POST(_req: Request, { params }: Params) {
  const { token } = await params
  const { error, session } = await requireAuth()
  if (error) return error

  const invitation = await db.invitation.findUnique({
    where: { token },
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

  if (invitation.email && invitation.email.toLowerCase() !== session!.user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: 'You are not authorized to decline this invitation' },
      { status: 403 }
    )
  }

  await db.invitation.update({
    where: { token },
    data: { status: 'DECLINED' },
  })

  return NextResponse.json({ success: true })
}
