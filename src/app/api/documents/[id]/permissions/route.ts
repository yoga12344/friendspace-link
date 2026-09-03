import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyDocumentAccess } from '@/lib/phase5-auth'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const addPermSchema = z.object({
  userId: z.string().min(1),
  canEdit: z.boolean().default(false),
})

// GET /api/documents/[id]/permissions — list document permissions
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error } = await verifyDocumentAccess(id, 'view')
  if (error) return error

  const permissions = await db.documentPermission.findMany({
    where: { documentId: id },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  })

  return NextResponse.json({ permissions })
}

// POST /api/documents/[id]/permissions — set permission for user
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, document, workspaceMember } = await verifyDocumentAccess(id, 'edit')
  if (error) return error

  const userId = session!.user.id
  const isCreator = document!.creatorId === userId
  const isOwnerOrAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isCreator && !isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Only the creator or admin can manage document permissions' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const parsed = addPermSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const targetUserId = parsed.data.userId

  // Verify target user is in this workspace
  const targetMember = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: document!.workspaceId,
        userId: targetUserId,
      },
    },
  })

  if (!targetMember) {
    return NextResponse.json(
      { error: 'Cannot grant permission to user outside this workspace' },
      { status: 400 }
    )
  }

  const perm = await db.documentPermission.upsert({
    where: {
      documentId_userId: {
        documentId: id,
        userId: targetUserId,
      },
    },
    update: { canEdit: parsed.data.canEdit },
    create: {
      documentId: id,
      userId: targetUserId,
      canEdit: parsed.data.canEdit,
    },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  })

  // Notify target user
  await createNotification({
    workspaceId: document!.workspaceId,
    recipientId: targetUserId,
    actorId: userId,
    type: 'DOCUMENT_SHARED',
    title: 'Document Shared',
    body: `A document "${document!.title}" was shared with you`,
    link: `/docs/${id}`,
    entityType: 'document',
    entityId: id,
  })

  return NextResponse.json({ permission: perm })
}
