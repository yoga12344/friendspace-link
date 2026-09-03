import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyConversationAdmin, verifyConversationMember } from '@/lib/conversation-auth'
import { emitSocketEvent } from '@/lib/socket-broadcast'

type Params = { params: Promise<{ id: string; userId: string }> }

// DELETE /api/conversations/[id]/members/[userId] — remove member from group
export async function DELETE(_req: Request, { params }: Params) {
  const { id, userId } = await params

  // Verify caller membership
  const memberCheck = await verifyConversationMember(id)
  if (memberCheck.error) return memberCheck.error

  const currentUserId = memberCheck.session!.user.id

  // If removing someone else, must be admin
  if (userId !== currentUserId) {
    const adminCheck = await verifyConversationAdmin(id)
    if (adminCheck.error) return adminCheck.error
  }

  const targetMember = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId } },
  })

  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  await db.conversationMember.delete({
    where: { conversationId_userId: { conversationId: id, userId } },
  })

  await emitSocketEvent(`conversation:${id}`, 'member.left', {
    conversationId: id,
    userId,
  })

  return NextResponse.json({ success: true })
}
