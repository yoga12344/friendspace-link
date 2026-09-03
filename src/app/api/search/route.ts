import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, verifyWorkspaceMember } from '@/lib/workspace-auth'
import { checkRateLimit } from '@/lib/rate-limit'

// GET /api/search — Global Search across all workspace entities
export async function GET(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  // Rate limit: max 60 search queries per minute per user
  const rate = checkRateLimit(`search:${userId}`, { limit: 60, windowMs: 60000 })
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Search rate limit exceeded. Please slow down.' },
      { status: 429 }
    )
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const workspaceId = searchParams.get('workspaceId')
  const type = searchParams.get('type') || 'all'
  const limitPerType = Math.min(parseInt(searchParams.get('limit') || '5'), 15)

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  // Mandatory workspace isolation check
  const { error: wsError } = await verifyWorkspaceMember(workspaceId)
  if (wsError) return wsError

  if (!q || q.length < 1) {
    return NextResponse.json({
      results: {
        projects: [],
        tasks: [],
        documents: [],
        files: [],
        messages: [],
        events: [],
        members: [],
      },
    })
  }

  const query = q.toLowerCase()

  // Run database queries filtered strictly by workspaceId
  const [
    projects,
    tasks,
    documents,
    files,
    events,
    members,
    messages,
  ] = await Promise.all([
    // 1. Projects
    type === 'all' || type === 'projects'
      ? db.project.findMany({
          where: {
            workspaceId,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: limitPerType,
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            color: true,
            status: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),

    // 2. Tasks
    type === 'all' || type === 'tasks'
      ? db.task.findMany({
          where: {
            workspaceId,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: limitPerType,
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            project: { select: { id: true, name: true, icon: true } },
          },
        })
      : Promise.resolve([]),

    // 3. Documents
    type === 'all' || type === 'documents'
      ? db.document.findMany({
          where: {
            workspaceId,
            title: { contains: query, mode: 'insensitive' },
          },
          take: limitPerType,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            project: { select: { id: true, name: true, icon: true } },
          },
        })
      : Promise.resolve([]),

    // 4. Files
    type === 'all' || type === 'files'
      ? db.file.findMany({
          where: {
            workspaceId,
            name: { contains: query, mode: 'insensitive' },
          },
          take: limitPerType,
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
            url: true,
            createdAt: true,
            project: { select: { id: true, name: true, icon: true } },
          },
        })
      : Promise.resolve([]),

    // 5. Calendar Events
    type === 'all' || type === 'events'
      ? db.event.findMany({
          where: {
            workspaceId,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { location: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: limitPerType,
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            location: true,
            project: { select: { id: true, name: true, icon: true } },
          },
        })
      : Promise.resolve([]),

    // 6. Workspace Members
    type === 'all' || type === 'members'
      ? db.workspaceMember.findMany({
          where: {
            workspaceId,
            user: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { username: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            },
          },
          take: limitPerType,
          include: {
            user: { select: { id: true, name: true, username: true, image: true, email: true } },
          },
        })
      : Promise.resolve([]),

    // 7. Messages (in conversations user participates in)
    type === 'all' || type === 'messages'
      ? db.message.findMany({
          where: {
            deletedAt: null,
            content: { contains: query, mode: 'insensitive' },
            conversation: {
              members: { some: { userId } },
              OR: [{ workspaceId }, { workspaceId: null }],
            },
          },
          take: limitPerType,
          select: {
            id: true,
            content: true,
            conversationId: true,
            createdAt: true,
            sender: { select: { id: true, name: true, image: true } },
          },
        })
      : Promise.resolve([]),
  ])

  return NextResponse.json({
    results: {
      projects,
      tasks,
      documents,
      files,
      events,
      members,
      messages,
    },
    totalCount:
      projects.length +
      tasks.length +
      documents.length +
      files.length +
      events.length +
      members.length +
      messages.length,
  })
}
