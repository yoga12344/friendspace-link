import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTaskAccess } from '@/lib/project-auth'

type Params = { params: Promise<{ id: string; tagId: string }> }

// DELETE /api/tasks/[id]/tags/[tagId] — remove tag from task
export async function DELETE(_req: Request, { params }: Params) {
  const { id, tagId } = await params
  const { error } = await verifyTaskAccess(id)
  if (error) return error

  await db.taskTag.deleteMany({
    where: {
      id: tagId,
      taskId: id,
    },
  })

  return NextResponse.json({ success: true, message: 'Tag removed' })
}
