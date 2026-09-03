import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { z } from 'zod'
import { slugify } from '@/lib/utils'

const createSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
  icon: z.string().max(2).optional(),
})

// GET /api/workspaces — list user's workspaces
export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const memberships = await db.workspaceMember.findMany({
    where: { userId: session!.user.id },
    include: {
      workspace: {
        select: {
          id: true, name: true, slug: true, icon: true, description: true,
          ownerId: true, createdAt: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({
    workspaces: memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
      memberCount: m.workspace._count.members,
    })),
  })
}

// POST /api/workspaces — create workspace
export async function POST(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  const { name, description, icon } = parsed.data
  let slug = slugify(name)

  // Ensure slug uniqueness
  const existing = await db.workspace.findUnique({ where: { slug } })
  if (existing) slug = `${slug}-${Date.now().toString(36)}`

  const workspace = await db.workspace.create({
    data: {
      name,
      description,
      icon: icon ?? null,
      slug,
      ownerId: session!.user.id,
      members: {
        create: { userId: session!.user.id, role: 'OWNER' },
      },
    },
  })

  return NextResponse.json({ workspace }, { status: 201 })
}
