import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyConversationMember } from '@/lib/conversation-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'

type Params = { params: Promise<{ id: string }> }

// POST /api/conversations/[id]/read — mark conversation as read
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, session } = await verifyConversationMember(id)
  if (error) return error

  const userId = session!.user.id
  const now = new Date()

  // Update lastReadAt on ConversationMember
  await db.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId,
      },
    },
    data: { lastReadAt: now },
  })

  // Also create MessageRead records for unread messages in this conversation
  const unreadMessages = await db.message.findMany({
    where: {
      conversationId: id,
      senderId: { not: userId },
      deletedAt: null,
      reads: {
        none: { userId },
      },
    },
    select: { id: true },
    take: 50,
  })

  if (unreadMessages.length > 0) {
    await db.messageRead.createMany({
      data: unreadMessages.map((msg) => ({
        messageId: msg.id,
        userId,
        readAt: now,
      })),
      skipDuplicates: true,
    })
  }

  // Broadcast read event to conversation room
  await emitSocketEvent(`conversation:${id}`, 'conversation.read', {
    conversationId: id,
    userId,
    readAt: now,
  })

  return NextResponse.json({ success: true, readAt: now })
}
