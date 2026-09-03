import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTaskAccess } from '@/lib/project-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string; commentId: string }> }

const editCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
})

// PATCH /api/tasks/[id]/comments/[commentId] — edit own comment
export async function PATCH(req: Request, { params }: Params) {
  const { id, commentId } = await params
  const { error, session } = await verifyTaskAccess(id)
  if (error) return error

  const userId = session!.user.id

  const comment = await db.taskComment.findUnique({
    where: { id: commentId },
  })

  if (!comment || comment.taskId !== id) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  if (comment.authorId !== userId) {
    return NextResponse.json({ error: 'You can only edit your own comments' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = editCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updated = await db.taskComment.update({
    where: { id: commentId },
    data: { content: parsed.data.content.trim() },
    include: {
      author: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
  })

  return NextResponse.json({ comment: updated })
}

// DELETE /api/tasks/[id]/comments/[commentId] — delete own comment
export async function DELETE(_req: Request, { params }: Params) {
  const { id, commentId } = await params
  const { error, session, workspaceMember } = await verifyTaskAccess(id)
  if (error) return error

  const userId = session!.user.id

  const comment = await db.taskComment.findUnique({
    where: { id: commentId },
  })

  if (!comment || comment.taskId !== id) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const isAuthor = comment.authorId === userId
  const isWorkspaceAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isAuthor && !isWorkspaceAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized to delete this comment' },
      { status: 403 }
    )
  }

  await db.taskComment.delete({ where: { id: commentId } })

  return NextResponse.json({ success: true, message: 'Comment deleted' })
}
