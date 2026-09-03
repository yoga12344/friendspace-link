import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function verifyConversationMember(conversationId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
      member: null,
      conversation: null,
    }
  }

  const userId = session.user.id

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, image: true, status: true },
          },
        },
      },
    },
  })

  if (!conversation) {
    return {
      error: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }),
      session: null,
      member: null,
      conversation: null,
    }
  }

  const member = conversation.members.find((m) => m.userId === userId)
  if (!member) {
    return {
      error: NextResponse.json({ error: 'You are not a member of this conversation' }, { status: 403 }),
      session: null,
      member: null,
      conversation: null,
    }
  }

  return {
    error: null,
    session,
    member,
    conversation,
  }
}

export async function verifyConversationAdmin(conversationId: string) {
  const result = await verifyConversationMember(conversationId)
  if (result.error) return result

  const { member, conversation } = result

  // If DIRECT conversation, neither is admin; or both can manage
  if (conversation!.type === 'DIRECT') {
    return result
  }

  // If creator of conversation, or role is ADMIN
  const isCreator = conversation!.createdById === member!.userId
  const isAdmin = member!.role === 'ADMIN'

  if (!isCreator && !isAdmin) {
    return {
      error: NextResponse.json({ error: 'Admin privileges required' }, { status: 403 }),
      session: null,
      member: null,
      conversation: null,
    }
  }

  return result
}
