import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyConversationMember } from '@/lib/conversation-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const attachmentSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  size: z.number().int().positive(),
  mimeType: z.string().min(1),
})

const createMessageSchema = z.object({
  content: z.string().max(5000).default(''),
  replyToId: z.string().optional().nullable(),
  attachments: z.array(attachmentSchema).optional(),
})

// GET /api/conversations/[id]/messages — cursor-based message history
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const { error } = await verifyConversationMember(id)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)
  const cursor = searchParams.get('cursor')

  const messages = await db.message.findMany({
    where: { conversationId: id },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: {
        select: { id: true, name: true, username: true, image: true },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          deletedAt: true,
          sender: { select: { id: true, name: true } },
        },
      },
      reactions: {
        select: { id: true, emoji: true, userId: true },
      },
      attachments: {
        select: { id: true, name: true, url: true, size: true, mimeType: true },
      },
      reads: {
        select: { userId: true, readAt: true },
      },
    },
  })

  let nextCursor: string | null = null
  if (messages.length > limit) {
    const nextItem = messages.pop()
    nextCursor = nextItem ? nextItem.id : null
  }

  // Format messages: redact deleted message content
  const formatted = messages.reverse().map((msg) => ({
    id: msg.id,
    conversationId: msg.conversationId,
    content: msg.deletedAt ? 'Message deleted' : msg.content,
    senderId: msg.senderId,
    sender: msg.sender,
    replyTo: msg.replyTo
      ? {
          id: msg.replyTo.id,
          content: msg.replyTo.deletedAt ? 'Message deleted' : msg.replyTo.content,
          senderName: msg.replyTo.sender.name,
        }
      : null,
    reactions: msg.reactions,
    attachments: msg.deletedAt ? [] : msg.attachments,
    reads: msg.reads,
    editedAt: msg.editedAt,
    deletedAt: msg.deletedAt,
    createdAt: msg.createdAt,
  }))

  return NextResponse.json({
    messages: formatted,
    nextCursor,
  })
}

// POST /api/conversations/[id]/messages — send a message
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, conversation } = await verifyConversationMember(id)
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = createMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { content, replyToId, attachments } = parsed.data

  const trimmedContent = content.trim()
  if (!trimmedContent && (!attachments || attachments.length === 0)) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }

  // Verify replyToId exists in this conversation if provided
  if (replyToId) {
    const replyTarget = await db.message.findUnique({ where: { id: replyToId } })
    if (!replyTarget || replyTarget.conversationId !== id) {
      return NextResponse.json({ error: 'Invalid reply message' }, { status: 400 })
    }
  }

  // Create message and update conversation in transaction
  const now = new Date()
  const [message] = await db.$transaction([
    db.message.create({
      data: {
        conversationId: id,
        senderId: userId,
        content: trimmedContent,
        replyToId: replyToId || null,
        attachments: attachments && attachments.length > 0
          ? {
              create: attachments.map((att) => ({
                name: att.name,
                url: att.url,
                size: att.size,
                mimeType: att.mimeType,
              })),
            }
          : undefined,
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, image: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            deletedAt: true,
            sender: { select: { id: true, name: true } },
          },
        },
        attachments: true,
        reactions: true,
        reads: true,
      },
    }),
    db.conversation.update({
      where: { id },
      data: { lastMessageAt: now },
    }),
    // Update sender's lastReadAt
    db.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId } },
      data: { lastReadAt: now },
    }),
  ])

  const formatted = {
    id: message.id,
    conversationId: message.conversationId,
    content: message.content,
    senderId: message.senderId,
    sender: message.sender,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          content: message.replyTo.deletedAt ? 'Message deleted' : message.replyTo.content,
          senderName: message.replyTo.sender.name,
        }
      : null,
    reactions: message.reactions,
    attachments: message.attachments,
    reads: message.reads,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    createdAt: message.createdAt,
  }

  // Broadcast to room
  await emitSocketEvent(`conversation:${id}`, 'message.created', {
    conversationId: id,
    message: formatted,
  })

  // Notify other members
  const convMembers = await db.conversationMember.findMany({
    where: { conversationId: id, userId: { not: userId } },
    select: { userId: true },
  })

  for (const m of convMembers) {
    await createNotification({
      workspaceId: conversation.workspaceId || undefined,
      recipientId: m.userId,
      actorId: userId,
      type: 'MESSAGE',
      title: `Message from ${session.user.name}`,
      body: content?.slice(0, 80) || 'Sent an attachment',
      link: `/chat`,
      entityType: 'conversation',
      entityId: id,
    })
  }

  return NextResponse.json({ message: formatted }, { status: 201 })
}
