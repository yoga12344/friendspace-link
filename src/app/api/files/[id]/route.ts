import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyFileAccess } from '@/lib/phase5-auth'
import fs from 'fs'
import path from 'path'

type Params = { params: Promise<{ id: string }> }

// GET /api/files/[id] — file detail
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, file } = await verifyFileAccess(id)
  if (error) return error

  return NextResponse.json({ file })
}

// DELETE /api/files/[id] — delete file
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, session, file, workspaceMember } = await verifyFileAccess(id)
  if (error) return error

  const userId = session!.user.id
  const isUploader = file!.uploaderId === userId
  const isOwnerOrAdmin =
    workspaceMember!.role === 'OWNER' || workspaceMember!.role === 'ADMIN'

  if (!isUploader && !isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Only the uploader or workspace admin can delete this file' },
      { status: 403 }
    )
  }

  // Delete from disk if exists
  if (file!.url.startsWith('/uploads/')) {
    const filename = file!.url.replace('/uploads/', '')
    const filePath = path.join(process.cwd(), 'public', 'uploads', filename)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        // ignore disk deletion failure
      }
    }
  }

  await db.file.delete({ where: { id } })

  return NextResponse.json({ success: true, message: 'File deleted' })
}
