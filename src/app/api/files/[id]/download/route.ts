import { NextResponse } from 'next/server'
import { verifyFileAccess } from '@/lib/phase5-auth'
import { storage } from '@/lib/storage'

type Params = { params: Promise<{ id: string }> }

// GET /api/files/[id]/download — secure file download with workspace verification
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, file } = await verifyFileAccess(id)
  if (error) return error

  // Retrieve file buffer via storage provider abstraction
  const fileBuffer = await storage.getFileBuffer(file!.url)

  if (!fileBuffer) {
    return NextResponse.json({ error: 'File not found on server' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file!.name)}"`,
      'Content-Type': file!.mimeType || 'application/octet-stream',
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  })
}
