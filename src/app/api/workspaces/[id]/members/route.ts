import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyWorkspaceMember, verifyWorkspaceRole } from '@/lib/workspace-auth'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

// GET /api/workspaces/[id]/members
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const { error } = await verifyWorkspaceMember(id)
  if (error) return error

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: id },
    include: {
      user: {
        select: {
          id: true, name: true, username: true, image: true,
          status: true, lastActiveAt: true,
        },
      },
    },
    orderBy: [
      { role: 'asc' },   // OWNER first (alphabetically ADMIN < MEMBER < OWNER, but sorted by role value)
      { joinedAt: 'asc' },
    ],
  })

  return NextResponse.json({ members })
}
