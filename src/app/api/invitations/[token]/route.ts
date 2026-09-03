import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'

type Params = { params: Promise<{ token: string }> }

// GET /api/invitations/[token] — get invitation details (public, no auth required to view)
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true, icon: true, description: true } },
      sender: { select: { id: true, name: true, username: true, image: true } },
    },
  })

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (invitation.status !== 'PENDING') {
    return NextResponse.json({ error: 'This invitation is no longer valid', status: invitation.status }, { status: 410 })
  }

  if (new Date() > invitation.expiresAt) {
    await db.invitation.update({ where: { token }, data: { status: 'EXPIRED' } })
    return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
  }

  return NextResponse.json({ invitation })
}
