import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyConversationAdmin } from '@/lib/conversation-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const addMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
})

// POST /api/conversations/[id]/members — add members to group
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, conversation } = await verifyConversationAdmin(id)
  if (error) return error

  if (conversation!.type === 'DIRECT') {
    return NextResponse.json({ error: 'Cannot add members to a direct conversation' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = addMembersSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { userIds } = parsed.data

  // Filter out existing members
  const existingMemberIds = new Set(conversation!.members.map((m) => m.userId))
  const newMemberIds = userIds.filter((uId) => !existingMemberIds.has(uId))

  if (newMemberIds.length === 0) {
    return NextResponse.json({ message: 'All specified users are already members' })
  }

  await db.conversationMember.createMany({
    data: newMemberIds.map((userId) => ({
      conversationId: id,
      userId,
      role: 'MEMBER',
    })),
  })

  // Broadcast to room
  await emitSocketEvent(`conversation:${id}`, 'members.added', {
    conversationId: id,
    newMemberIds,
  })

  return NextResponse.json({ success: true, addedCount: newMemberIds.length })
}
