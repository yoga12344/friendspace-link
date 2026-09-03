import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const reactionSchema = z.object({
  emoji: z.string().min(1).max(8),
})

// POST /api/messages/[id]/reactions — add or toggle reaction
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  const message = await db.message.findUnique({
    where: { id },
    include: {
      conversation: {
        include: { members: true },
      },
    },
  })

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Verify membership in conversation
  const isMember = message.conversation.members.some((m) => m.userId === userId)
  if (!isMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = reactionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { emoji } = parsed.data

  // Check if reaction already exists from this user
  const existing = await db.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId: id,
        userId,
        emoji,
      },
    },
  })

  if (existing) {
    // Toggle off
    await db.messageReaction.delete({ where: { id: existing.id } })

    await emitSocketEvent(`conversation:${message.conversationId}`, 'message.reaction.removed', {
      conversationId: message.conversationId,
      messageId: id,
      reactionId: existing.id,
      userId,
      emoji,
    })

    return NextResponse.json({ removed: true, reactionId: existing.id })
  }

  // Create reaction
  const reaction = await db.messageReaction.create({
    data: {
      messageId: id,
      userId,
      emoji,
    },
  })

  await emitSocketEvent(`conversation:${message.conversationId}`, 'message.reaction.added', {
    conversationId: message.conversationId,
    messageId: id,
    reaction,
  })

  return NextResponse.json({ reaction }, { status: 201 })
}
