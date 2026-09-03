import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTaskAccess } from '@/lib/project-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string; checklistId: string }> }

const updateChecklistSchema = z.object({
  checked: z.boolean().optional(),
  content: z.string().min(1).max(300).optional(),
})

// PATCH /api/tasks/[id]/checklists/[checklistId] — toggle or rename checklist item
export async function PATCH(req: Request, { params }: Params) {
  const { id, checklistId } = await params
  const { error } = await verifyTaskAccess(id)
  if (error) return error

  const item = await db.taskChecklist.findUnique({
    where: { id: checklistId },
  })

  if (!item || item.taskId !== id) {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = updateChecklistSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updated = await db.taskChecklist.update({
    where: { id: checklistId },
    data: {
      ...(parsed.data.checked !== undefined ? { checked: parsed.data.checked } : {}),
      ...(parsed.data.content !== undefined ? { content: parsed.data.content.trim() } : {}),
    },
  })

  return NextResponse.json({ item: updated })
}

// DELETE /api/tasks/[id]/checklists/[checklistId] — delete checklist item
export async function DELETE(_req: Request, { params }: Params) {
  const { id, checklistId } = await params
  const { error } = await verifyTaskAccess(id)
  if (error) return error

  await db.taskChecklist.deleteMany({
    where: {
      id: checklistId,
      taskId: id,
    },
  })

  return NextResponse.json({ success: true, message: 'Checklist item deleted' })
}
