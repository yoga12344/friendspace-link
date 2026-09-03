import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTaskAccess } from '@/lib/project-auth'

type Params = { params: Promise<{ id: string; userId: string }> }

// DELETE /api/tasks/[id]/assignees/[userId] — unassign user from task
export async function DELETE(_req: Request, { params }: Params) {
  const { id, userId } = await params
  const { error } = await verifyTaskAccess(id)
  if (error) return error

  await db.taskAssignee.deleteMany({
    where: {
      taskId: id,
      userId,
    },
  })

  return NextResponse.json({ success: true, message: 'Assignee removed' })
}
