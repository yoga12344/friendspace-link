import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const actionSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
})

function canonicalPair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1]
}

// PATCH /api/friends/[id] — accept or reject friend request (id = friendRequestId)
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  const body = await req.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const request = await db.friendRequest.findUnique({
    where: { id },
  })

  if (!request) {
    return NextResponse.json({ error: 'Friend request not found' }, { status: 404 })
  }

  // Only the receiver can accept or reject
  if (request.receiverId !== userId) {
    return NextResponse.json({ error: 'You are not authorized to respond to this request' }, { status: 403 })
  }

  if (request.status !== 'PENDING') {
    return NextResponse.json({ error: `Request already ${request.status.toLowerCase()}` }, { status: 400 })
  }

  if (parsed.data.action === 'ACCEPT') {
    const [userAId, userBId] = canonicalPair(request.senderId, request.receiverId)

    const [friendship] = await db.$transaction([
      db.friendship.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
      }),
      db.friendRequest.update({
        where: { id },
        data: { status: 'ACCEPTED' },
      }),
    ])

    return NextResponse.json({ success: true, friendship })
  } else {
    // REJECT
    await db.friendRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
    })

    return NextResponse.json({ success: true, status: 'REJECTED' })
  }
}

// DELETE /api/friends/[id] — remove friend or cancel outgoing friend request
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  // Check if id is a Friendship id
  const friendship = await db.friendship.findUnique({ where: { id } })
  if (friendship) {
    if (friendship.userAId !== userId && friendship.userBId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to remove this friendship' }, { status: 403 })
    }
    await db.friendship.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Friend removed' })
  }

  // Check if id is a FriendRequest id (to cancel outgoing request)
  const request = await db.friendRequest.findUnique({ where: { id } })
  if (request) {
    if (request.senderId !== userId && request.receiverId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    await db.friendRequest.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Request removed' })
  }

  return NextResponse.json({ error: 'Record not found' }, { status: 404 })
}
