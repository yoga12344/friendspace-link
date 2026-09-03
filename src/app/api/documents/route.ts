import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, verifyWorkspaceMember } from '@/lib/workspace-auth'
import { createActivity } from '@/lib/activity'
import { z } from 'zod'

const createDocSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace is required'),
  projectId: z.string().optional().nullable(),
  title: z.string().min(1, 'Document title is required').max(120),
  content: z.any().optional(),
})

// GET /api/documents — list documents in workspace (or project)
export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const projectId = searchParams.get('projectId')
  const q = searchParams.get('q')?.toLowerCase()

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const { error: wsError } = await verifyWorkspaceMember(workspaceId)
  if (wsError) return wsError

  const docs = await db.document.findMany({
    where: {
      workspaceId,
      ...(projectId ? { projectId } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
    include: {
      creator: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
      permissions: true,
    },
    take: 100,
    orderBy: { updatedAt: 'desc' },
  })

  // Filter out restricted docs that user does not have permission to view
  const accessibleDocs = docs.filter((doc) => {
    if (doc.permissions.length === 0) return true
    if (doc.creatorId === userId) return true
    return doc.permissions.some((p) => p.userId === userId)
  })

  return NextResponse.json({ documents: accessibleDocs })
}

// POST /api/documents — create document
export async function POST(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = createDocSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { workspaceId, projectId, title, content } = parsed.data

  const { error: wsError } = await verifyWorkspaceMember(workspaceId)
  if (wsError) return wsError

  // If projectId is provided, verify it belongs to this workspace
  if (projectId) {
    const proj = await db.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    })
    if (!proj || proj.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Project does not belong to this workspace' },
        { status: 400 }
      )
    }
  }

  const doc = await db.document.create({
    data: {
      workspaceId,
      projectId: projectId || null,
      creatorId: userId,
      title: title.trim(),
      content: content || {},
    },
    include: {
      creator: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
    },
  })

  await createActivity({
    workspaceId,
    actorId: userId,
    type: 'DOCUMENT_CREATED',
    entityType: 'document',
    entityId: doc.id,
    entityName: doc.title,
    projectId: doc.projectId,
  })

  return NextResponse.json({ document: doc }, { status: 201 })
}
