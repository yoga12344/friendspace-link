import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTaskAccess } from '@/lib/project-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const createChecklistSchema = z.object({
  content: z.string().min(1, 'Content is required').max(300),
})

// POST /api/tasks/[id]/checklists — add checklist item
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error } = await verifyTaskAccess(id)
  if (error) return error

  const body = await req.json()
  const parsed = createChecklistSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Get current max order
  const highestOrder = await db.taskChecklist.findFirst({
    where: { taskId: id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const item = await db.taskChecklist.create({
    data: {
      taskId: id,
      content: parsed.data.content.trim(),
      order: (highestOrder?.order ?? -1) + 1,
      checked: false,
    },
  })

  return NextResponse.json({ item }, { status: 201 })
}
