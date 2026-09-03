import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER'

// Verify user is authenticated and a member of the workspace
// Returns the membership or throws a NextResponse error
export async function verifyWorkspaceMember(workspaceId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      member: null,
      session: null,
    }
  }

  const member = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: session.user.id },
    },
    include: { workspace: true },
  })

  if (!member) {
    return {
      error: NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 }),
      member: null,
      session: null,
    }
  }

  return { error: null, member, session }
}

// Verify user has at least the required role
export async function verifyWorkspaceRole(
  workspaceId: string,
  requiredRole: WorkspaceRole
) {
  const result = await verifyWorkspaceMember(workspaceId)
  if (result.error) return result

  const roleHierarchy: Record<WorkspaceRole, number> = {
    OWNER: 3,
    ADMIN: 2,
    MEMBER: 1,
  }

  const userLevel = roleHierarchy[result.member!.role as WorkspaceRole]
  const requiredLevel = roleHierarchy[requiredRole]

  if (userLevel < requiredLevel) {
    return {
      error: NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      ),
      member: null,
      session: null,
    }
  }

  return result
}

// Get authenticated session or return 401
export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
    }
  }
  return { error: null, session }
}
