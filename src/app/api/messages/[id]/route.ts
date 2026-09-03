import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const editSchema = z.object({
  content: z.string().min(1).max(5000),
})

// PATCH /api/messages/[id] — edit message
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  const message = await db.message.findUnique({
    where: { id },
  })

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (message.senderId !== userId) {
    return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 })
  }

  if (message.deletedAt) {
    return NextResponse.json({ error: 'Cannot edit a deleted message' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updated = await db.message.update({
    where: { id },
    data: {
      content: parsed.data.content.trim(),
      editedAt: new Date(),
    },
  })

  await emitSocketEvent(`conversation:${message.conversationId}`, 'message.updated', {
    conversationId: message.conversationId,
    messageId: id,
    content: updated.content,
    editedAt: updated.editedAt,
  })

  return NextResponse.json({ message: updated })
}

// DELETE /api/messages/[id] — soft delete message
export async function DELETE(_req: Request, { params }: Params) {
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

  // Check if sender or group admin
  const isSender = message.senderId === userId
  const member = message.conversation.members.find((m) => m.userId === userId)
  const isGroupAdmin =
    message.conversation.type === 'GROUP' &&
    (member?.role === 'ADMIN' || message.conversation.createdById === userId)

  if (!isSender && !isGroupAdmin) {
    return NextResponse.json({ error: 'Unauthorized to delete this message' }, { status: 403 })
  }

  const updated = await db.message.update({
    where: { id },
    data: {
      content: 'Message deleted',
      deletedAt: new Date(),
    },
  })

  await emitSocketEvent(`conversation:${message.conversationId}`, 'message.deleted', {
    conversationId: message.conversationId,
    messageId: id,
    deletedAt: updated.deletedAt,
  })

  return NextResponse.json({ success: true, messageId: id })
}
