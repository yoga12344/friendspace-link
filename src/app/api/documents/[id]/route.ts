import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyDocumentAccess } from '@/lib/phase5-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const updateDocSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  content: z.any().optional(),
})

// GET /api/documents/[id] — document detail
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, document } = await verifyDocumentAccess(id, 'view')
  if (error) return error

  return NextResponse.json({ document })
}

// PATCH /api/documents/[id] — update document (autosave)
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session } = await verifyDocumentAccess(id, 'edit')
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = updateDocSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { title, content } = parsed.data

  const updated = await db.document.update({
    where: { id },
    data: {
      ...(title ? { title: title.trim() } : {}),
      ...(content !== undefined ? { content } : {}),
      lastEditedAt: new Date(),
      lastEditorId: userId,
    },
    include: {
      creator: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
    },
  })

  return NextResponse.json({ document: updated })
}

// DELETE /api/documents/[id] — delete document
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, document, workspaceMember } = await verifyDocumentAccess(id, 'edit')
  if (error) return error

  const userId = session!.user.id
  const isCreator = document!.creatorId === userId
  const isOwnerOrAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isCreator && !isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Only the creator or workspace admin can delete this document' },
      { status: 403 }
    )
  }

  await db.document.delete({ where: { id } })

  return NextResponse.json({ success: true, message: 'Document deleted' })
}
