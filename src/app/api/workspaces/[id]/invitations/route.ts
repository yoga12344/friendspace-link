import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyWorkspaceRole } from '@/lib/workspace-auth'
import { z } from 'zod'
import { addDays } from 'date-fns'

type Params = { params: Promise<{ id: string }> }

const inviteSchema = z.object({
  email: z.string().email().optional(),
})

// GET /api/workspaces/[id]/invitations — list active invitations (Admin+)
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error } = await verifyWorkspaceRole(id, 'ADMIN')
  if (error) return error

  const invitations = await db.invitation.findMany({
    where: { workspaceId: id, status: 'PENDING' },
    include: {
      sender: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ invitations })
}

// POST /api/workspaces/[id]/invitations — create invitation (Admin+)
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session } = await verifyWorkspaceRole(id, 'ADMIN')
  if (error) return error

  const body = await req.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const email = parsed.data.email?.toLowerCase()

  // Check if already a member
  if (email) {
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      const isMember = await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: id, userId: existingUser.id } },
      })
      if (isMember) {
        return NextResponse.json({ error: 'This person is already a member' }, { status: 409 })
      }
    }

    // Check for existing pending invite
    const existingInvite = await db.invitation.findFirst({
      where: { workspaceId: id, email, status: 'PENDING' },
    })
    if (existingInvite) {
      return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 409 })
    }
  }

  const invitation = await db.invitation.create({
    data: {
      workspaceId: id,
      senderId: session!.user.id,
      email,
      expiresAt: addDays(new Date(), 7), // 7-day expiry
      status: 'PENDING',
    },
  })

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`

  return NextResponse.json({ invitation, inviteUrl }, { status: 201 })
}
