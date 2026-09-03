import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyDocumentAccess } from '@/lib/phase5-auth'

type Params = { params: Promise<{ id: string; userId: string }> }

// DELETE /api/documents/[id]/permissions/[userId] — remove permission
export async function DELETE(_req: Request, { params }: Params) {
  const { id, userId } = await params
  const { error, session, document, workspaceMember } = await verifyDocumentAccess(id, 'edit')
  if (error) return error

  const currentUserId = session!.user.id
  const isCreator = document!.creatorId === currentUserId
  const isOwnerOrAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isCreator && !isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Only the creator or admin can remove document permissions' },
      { status: 403 }
    )
  }

  await db.documentPermission.deleteMany({
    where: {
      documentId: id,
      userId,
    },
  })

  return NextResponse.json({ success: true, message: 'Permission removed' })
}
