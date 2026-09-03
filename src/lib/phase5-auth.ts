import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function verifyDocumentAccess(documentId: string, requiredPermission: 'view' | 'edit' = 'view') {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
      document: null,
      workspaceMember: null,
    }
  }

  const userId = session.user.id

  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: {
      creator: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
      permissions: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
    },
  })

  if (!doc) {
    return {
      error: NextResponse.json({ error: 'Document not found' }, { status: 404 }),
      session: null,
      document: null,
      workspaceMember: null,
    }
  }

  // Verify workspace membership
  const workspaceMember = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: doc.workspaceId,
        userId,
      },
    },
  })

  if (!workspaceMember) {
    return {
      error: NextResponse.json(
        { error: 'You do not have access to this workspace or its documents' },
        { status: 403 }
      ),
      session: null,
      document: null,
      workspaceMember: null,
    }
  }

  const isOwnerOrAdmin =
    workspaceMember.role === 'OWNER' || workspaceMember.role === 'ADMIN'
  const isCreator = doc.creatorId === userId

  // Check document-level permissions if restricted
  if (doc.permissions.length > 0 && !isOwnerOrAdmin && !isCreator) {
    const userPerm = doc.permissions.find((p) => p.userId === userId)
    if (!userPerm) {
      return {
        error: NextResponse.json({ error: 'Access denied to this document' }, { status: 403 }),
        session: null,
        document: null,
        workspaceMember: null,
      }
    }
    if (requiredPermission === 'edit' && !userPerm.canEdit) {
      return {
        error: NextResponse.json({ error: 'You only have view permission' }, { status: 403 }),
        session: null,
        document: null,
        workspaceMember: null,
      }
    }
  }

  return {
    error: null,
    session,
    document: doc,
    workspaceMember,
  }
}

export async function verifyFileAccess(fileId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
      file: null,
      workspaceMember: null,
    }
  }

  const userId = session.user.id

  const file = await db.file.findUnique({
    where: { id: fileId },
    include: {
      uploader: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
      task: { select: { id: true, title: true } },
    },
  })

  if (!file) {
    return {
      error: NextResponse.json({ error: 'File not found' }, { status: 404 }),
      session: null,
      file: null,
      workspaceMember: null,
    }
  }

  const workspaceMember = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: file.workspaceId,
        userId,
      },
    },
  })

  if (!workspaceMember) {
    return {
      error: NextResponse.json(
        { error: 'You do not have access to this workspace or its files' },
        { status: 403 }
      ),
      session: null,
      file: null,
      workspaceMember: null,
    }
  }

  return {
    error: null,
    session,
    file,
    workspaceMember,
  }
}

export async function verifyEventAccess(eventId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
      event: null,
      workspaceMember: null,
    }
  }

  const userId = session.user.id

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      creator: { select: { id: true, name: true, username: true, image: true } },
      project: { select: { id: true, name: true, icon: true } },
      attendees: {
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
        },
      },
    },
  })

  if (!event) {
    return {
      error: NextResponse.json({ error: 'Event not found' }, { status: 404 }),
      session: null,
      event: null,
      workspaceMember: null,
    }
  }

  const workspaceMember = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: event.workspaceId,
        userId,
      },
    },
  })

  if (!workspaceMember) {
    return {
      error: NextResponse.json(
        { error: 'You do not have access to this workspace or its events' },
        { status: 403 }
      ),
      session: null,
      event: null,
      workspaceMember: null,
    }
  }

  return {
    error: null,
    session,
    event,
    workspaceMember,
  }
}
