import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyWorkspaceMember, verifyWorkspaceRole } from '@/lib/workspace-auth'
import { z } from 'zod'
import { slugify } from '@/lib/utils'

const updateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(200).optional().nullable(),
  icon: z.string().max(2).optional().nullable(),
})

type Params = { params: Promise<{ id: string }> }

// GET /api/workspaces/[id]
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, member } = await verifyWorkspaceMember(id)
  if (error) return error

  const workspace = await db.workspace.findUnique({
    where: { id },
    include: {
      _count: { select: { members: true, projects: true } },
    },
  })

  return NextResponse.json({ workspace: { ...workspace, role: member!.role } })
}

// PATCH /api/workspaces/[id] — edit (Admin+)
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const { error, member } = await verifyWorkspaceRole(id, 'ADMIN')
  if (error) return error

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name
    let slug = slugify(parsed.data.name)
    const existing = await db.workspace.findFirst({
      where: { slug, NOT: { id } },
    })
    if (existing) slug = `${slug}-${Date.now().toString(36)}`
    data.slug = slug
  }
  if ('description' in parsed.data) data.description = parsed.data.description
  if ('icon' in parsed.data) data.icon = parsed.data.icon

  const workspace = await db.workspace.update({ where: { id }, data })
  return NextResponse.json({ workspace })
}

// DELETE /api/workspaces/[id] — only Owner
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, member } = await verifyWorkspaceRole(id, 'OWNER')
  if (error) return error

  if (member!.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the workspace owner can delete it' }, { status: 403 })
  }

  await db.workspace.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
