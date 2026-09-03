import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTaskAccess } from '@/lib/project-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(30),
  color: z.string().max(20).optional(),
})

// POST /api/tasks/[id]/tags — add tag to task
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error } = await verifyTaskAccess(id)
  if (error) return error

  const body = await req.json()
  const parsed = createTagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, color } = parsed.data

  const tag = await db.taskTag.create({
    data: {
      taskId: id,
      name: name.trim().toLowerCase(),
      color: color || '#6366f1',
    },
  })

  return NextResponse.json({ tag }, { status: 201 })
}
