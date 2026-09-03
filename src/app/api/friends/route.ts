import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { z } from 'zod'

const sendRequestSchema = z.object({
  targetUserId: z.string().min(1),
})

// Helper to make canonical friendship pair
function canonicalPair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1]
}

// GET /api/friends — list friends, incoming requests, outgoing requests
export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  // 1. Fetch friendships
  const friendships = await db.friendship.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: {
      userA: {
        select: { id: true, name: true, username: true, image: true, status: true, lastActiveAt: true },
      },
      userB: {
        select: { id: true, name: true, username: true, image: true, status: true, lastActiveAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const friends = friendships.map((f) => {
    const friendUser = f.userAId === userId ? f.userB : f.userA
    return {
      friendshipId: f.id,
      friend: friendUser,
      since: f.createdAt,
    }
  })

  // 2. Incoming friend requests
  const incoming = await db.friendRequest.findMany({
    where: {
      receiverId: userId,
      status: 'PENDING',
    },
    include: {
      sender: {
        select: { id: true, name: true, username: true, image: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 3. Outgoing friend requests
  const outgoing = await db.friendRequest.findMany({
    where: {
      senderId: userId,
      status: 'PENDING',
    },
    include: {
      receiver: {
        select: { id: true, name: true, username: true, image: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    friends,
    incomingRequests: incoming,
    outgoingRequests: outgoing,
  })
}

// POST /api/friends — send a friend request
export async function POST(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const parsed = sendRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const currentUserId = session!.user.id
  const { targetUserId } = parsed.data

  if (targetUserId === currentUserId) {
    return NextResponse.json({ error: 'You cannot send a friend request to yourself' }, { status: 400 })
  }

  const targetUser = await db.user.findUnique({ where: { id: targetUserId } })
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Check if already friends
  const [userAId, userBId] = canonicalPair(currentUserId, targetUserId)
  const existingFriendship = await db.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  })
  if (existingFriendship) {
    return NextResponse.json({ error: 'You are already friends with this user' }, { status: 409 })
  }

  // Check if reverse request exists and is PENDING (auto-accept)
  const reverseRequest = await db.friendRequest.findUnique({
    where: {
      senderId_receiverId: {
        senderId: targetUserId,
        receiverId: currentUserId,
      },
    },
  })

  if (reverseRequest && reverseRequest.status === 'PENDING') {
    // Auto-accept
    const [friendship] = await db.$transaction([
      db.friendship.create({
        data: { userAId, userBId },
      }),
      db.friendRequest.update({
        where: { id: reverseRequest.id },
        data: { status: 'ACCEPTED' },
      }),
    ])

    return NextResponse.json({
      message: 'Friend request accepted!',
      isFriend: true,
      friendship,
    })
  }

  // Check if own request already exists
  const existingRequest = await db.friendRequest.findUnique({
    where: {
      senderId_receiverId: {
        senderId: currentUserId,
        receiverId: targetUserId,
      },
    },
  })

  if (existingRequest) {
    if (existingRequest.status === 'PENDING') {
      return NextResponse.json({ error: 'Friend request already sent and pending' }, { status: 409 })
    }
    // If was rejected or accepted previously, update back to pending
    const updated = await db.friendRequest.update({
      where: { id: existingRequest.id },
      data: { status: 'PENDING' },
    })
    return NextResponse.json({ request: updated }, { status: 200 })
  }

  // Create new friend request
  const request = await db.friendRequest.create({
    data: {
      senderId: currentUserId,
      receiverId: targetUserId,
      status: 'PENDING',
    },
  })

  return NextResponse.json({ request }, { status: 201 })
}
