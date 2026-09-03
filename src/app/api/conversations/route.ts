import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { z } from 'zod'
import { emitSocketEvent } from '@/lib/socket-broadcast'

function canonicalPair(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1]
}

const createConversationSchema = z.object({
  type: z.enum(['DIRECT', 'GROUP']).default('DIRECT'),
  targetUserId: z.string().optional(),
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(4).optional(),
  workspaceId: z.string().optional().nullable(),
  memberIds: z.array(z.string()).optional(),
})

// GET /api/conversations — list user's conversations
export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const q = searchParams.get('q')?.toLowerCase()

  // Find all conversation memberships for the current user
  const memberships = await db.conversationMember.findMany({
    where: {
      userId,
      ...(workspaceId ? { conversation: { workspaceId } } : {}),
    },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  image: true,
                  status: true,
                  lastActiveAt: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: {
      conversation: {
        lastMessageAt: 'desc',
      },
    },
  })

  // Format conversations
  const conversations = await Promise.all(
    memberships.map(async (m) => {
      const conv = m.conversation
      const lastMsg = conv.messages[0] || null

      // Calculate unread count
      const lastRead = m.lastReadAt || m.joinedAt
      const unreadCount = await db.message.count({
        where: {
          conversationId: conv.id,
          createdAt: { gt: lastRead },
          senderId: { not: userId },
          deletedAt: null,
        },
      })

      // For direct conversations, resolve the other user
      let otherUser = null
      let displayName = conv.name
      let displayIcon = conv.icon

      if (conv.type === 'DIRECT') {
        const otherMember = conv.members.find((member) => member.userId !== userId)
        if (otherMember) {
          otherUser = otherMember.user
          displayName = otherMember.user.name
        }
      }

      return {
        id: conv.id,
        type: conv.type,
        name: displayName,
        icon: displayIcon,
        workspaceId: conv.workspaceId,
        createdById: conv.createdById,
        lastMessageAt: conv.lastMessageAt || conv.createdAt,
        unreadCount,
        otherUser,
        members: conv.members.map((mem) => ({
          userId: mem.userId,
          role: mem.role,
          name: mem.user.name,
          username: mem.user.username,
          image: mem.user.image,
          status: mem.user.status,
        })),
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.deletedAt ? 'Message deleted' : lastMsg.content,
              senderId: lastMsg.senderId,
              senderName: lastMsg.sender.name,
              createdAt: lastMsg.createdAt,
              deletedAt: lastMsg.deletedAt,
            }
          : null,
      }
    })
  )

  // Filter by search query if provided
  const filtered = q
    ? conversations.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.otherUser?.username.toLowerCase().includes(q) ||
          c.lastMessage?.content.toLowerCase().includes(q)
      )
    : conversations

  return NextResponse.json({ conversations: filtered })
}

// POST /api/conversations — start direct conversation or create group
export async function POST(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = createConversationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { type, targetUserId, name, icon, workspaceId, memberIds } = parsed.data

  // DIRECT CONVERSATION
  if (type === 'DIRECT') {
    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID is required for direct conversation' }, { status: 400 })
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: 'Cannot create a direct conversation with yourself' }, { status: 400 })
    }

    const targetUser = await db.user.findUnique({ where: { id: targetUserId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [userAId, userBId] = canonicalPair(userId, targetUserId)
    const directKey = `${userAId}:${userBId}`

    // Check if direct conversation already exists
    const existing = await db.conversation.findUnique({
      where: { directKey },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true, status: true } },
          },
        },
      },
    })

    if (existing) {
      return NextResponse.json({ conversation: existing, isExisting: true })
    }

    // Create new direct conversation
    const conversation = await db.conversation.create({
      data: {
        type: 'DIRECT',
        directKey,
        workspaceId: workspaceId || null,
        createdById: userId,
        members: {
          create: [
            { userId: userAId, role: 'MEMBER' },
            { userId: userBId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true, status: true } },
          },
        },
      },
    })

    // Broadcast conversation created to participants
    await emitSocketEvent(null, 'conversation.created', { conversationId: conversation.id })

    return NextResponse.json({ conversation, isExisting: false }, { status: 201 })
  }

  // GROUP CONVERSATION
  if (type === 'GROUP') {
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    const uniqueMembers = Array.from(new Set([userId, ...(memberIds || [])]))

    const conversation = await db.conversation.create({
      data: {
        type: 'GROUP',
        name: name.trim(),
        icon: icon || '👥',
        workspaceId: workspaceId || null,
        createdById: userId,
        members: {
          create: uniqueMembers.map((mId) => ({
            userId: mId,
            role: mId === userId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true, status: true } },
          },
        },
      },
    })

    // Broadcast conversation created
    await emitSocketEvent(null, 'conversation.created', { conversationId: conversation.id })

    return NextResponse.json({ conversation }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid conversation type' }, { status: 400 })
}
