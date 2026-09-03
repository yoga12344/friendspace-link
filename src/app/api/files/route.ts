import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, verifyWorkspaceMember } from '@/lib/workspace-auth'
import { saveLocalFile } from '@/lib/storage'
import { createActivity } from '@/lib/activity'
import { checkRateLimit } from '@/lib/rate-limit'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// GET /api/files — list files in workspace
export async function GET(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const projectId = searchParams.get('projectId')
  const taskId = searchParams.get('taskId')
  const q = searchParams.get('q')?.toLowerCase()

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const { error: wsError } = await verifyWorkspaceMember(workspaceId)
  if (wsError) return wsError

  const files = await db.file.findMany({
    where: {
      workspaceId,
      ...(projectId ? { projectId } : {}),
      ...(taskId ? { taskId } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    include: {
      uploader: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
      task: { select: { id: true, title: true } },
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ files })
}

// POST /api/files — upload a file to workspace/project/task
export async function POST(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  // Rate limit: max 20 uploads per minute per user
  const rate = checkRateLimit(`upload:${userId}`, { limit: 20, windowMs: 60000 })
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Upload rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const workspaceId = formData.get('workspaceId') as string | null
    const projectId = formData.get('projectId') as string | null
    const taskId = formData.get('taskId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const { error: wsError } = await verifyWorkspaceMember(workspaceId)
    if (wsError) return wsError

    // Validate size (10MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not supported` },
        { status: 400 }
      )
    }

    // Save to local disk
    const saved = await saveLocalFile(file, file.name)

    // Save metadata in database
    const dbFile = await db.file.create({
      data: {
        workspaceId,
        projectId: projectId || null,
        taskId: taskId || null,
        uploaderId: userId,
        name: saved.name,
        url: saved.url,
        size: saved.size,
        mimeType: saved.mimeType,
      },
      include: {
        uploader: { select: { id: true, name: true, username: true, image: true } },
        project: { select: { id: true, name: true, icon: true } },
        task: { select: { id: true, title: true } },
      },
    })

    await createActivity({
      workspaceId,
      actorId: userId,
      type: taskId ? 'FILE_ATTACHED_TO_TASK' : 'FILE_UPLOADED',
      entityType: 'file',
      entityId: dbFile.id,
      entityName: dbFile.name,
      projectId: dbFile.projectId,
      metadata: { size: dbFile.size, mimeType: dbFile.mimeType, taskId },
    })

    return NextResponse.json({ file: dbFile }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'File upload failed' }, { status: 500 })
  }
}
