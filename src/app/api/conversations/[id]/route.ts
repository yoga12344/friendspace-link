import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyConversationMember, verifyConversationAdmin } from '@/lib/conversation-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(4).optional(),
})

// GET /api/conversations/[id] — get details
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, conversation, session } = await verifyConversationMember(id)
  if (error) return error

  const userId = session!.user.id

  // For direct conversations, format display name
  let otherUser = null
  let displayName = conversation!.name
  if (conversation!.type === 'DIRECT') {
    const otherMember = conversation!.members.find((m) => m.userId !== userId)
    if (otherMember) {
      otherUser = otherMember.user
      displayName = otherMember.user.name
    }
  }

  return NextResponse.json({
    conversation: {
      ...conversation,
      name: displayName,
      otherUser,
    },
  })
}

// PATCH /api/conversations/[id] — rename or update icon (Group Admin only)
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const { error, conversation } = await verifyConversationAdmin(id)
  if (error) return error

  if (conversation!.type === 'DIRECT') {
    return NextResponse.json({ error: 'Direct conversations cannot be renamed' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updated = await db.conversation.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.icon ? { icon: parsed.data.icon } : {}),
    },
  })

  await emitSocketEvent(`conversation:${id}`, 'conversation.updated', {
    conversationId: id,
    name: updated.name,
    icon: updated.icon,
  })

  return NextResponse.json({ conversation: updated })
}

// DELETE /api/conversations/[id] — delete conversation (Group creator) or leave
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, conversation, member, session } = await verifyConversationMember(id)
  if (error) return error

  const userId = session!.user.id

  if (conversation!.type === 'GROUP' && conversation!.createdById === userId) {
    // Creator deletes group conversation
    await db.conversation.delete({ where: { id } })
    await emitSocketEvent(`conversation:${id}`, 'conversation.deleted', { conversationId: id })
    return NextResponse.json({ success: true, message: 'Conversation deleted' })
  }

  // Otherwise, user leaves conversation
  await db.conversationMember.delete({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId,
      },
    },
  })

  await emitSocketEvent(`conversation:${id}`, 'member.left', { conversationId: id, userId })
  return NextResponse.json({ success: true, message: 'Left conversation' })
}
