import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'

type Params = { params: Promise<{ id: string; reactionId: string }> }

// DELETE /api/messages/[id]/reactions/[reactionId]
export async function DELETE(_req: Request, { params }: Params) {
  const { id, reactionId } = await params
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  const reaction = await db.messageReaction.findUnique({
    where: { id: reactionId },
    include: { message: true },
  })

  if (!reaction || reaction.messageId !== id) {
    return NextResponse.json({ error: 'Reaction not found' }, { status: 404 })
  }

  if (reaction.userId !== userId) {
    return NextResponse.json({ error: 'Unauthorized to remove this reaction' }, { status: 403 })
  }

  await db.messageReaction.delete({ where: { id: reactionId } })

  await emitSocketEvent(`conversation:${reaction.message.conversationId}`, 'message.reaction.removed', {
    conversationId: reaction.message.conversationId,
    messageId: id,
    reactionId,
    userId,
    emoji: reaction.emoji,
  })

  return NextResponse.json({ success: true })
}
