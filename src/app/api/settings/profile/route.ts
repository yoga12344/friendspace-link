import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { z } from 'zod'

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(60).optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  bio: z.string().max(250).optional().nullable(),
  image: z.string().url('Invalid image URL').optional().nullable(),
})

// GET /api/settings/profile — get authenticated user profile
export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const user = await db.user.findUnique({
    where: { id: session!.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      bio: true,
      image: true,
      timezone: true,
      createdAt: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ user })
}

// PATCH /api/settings/profile — update authenticated user profile
export async function PATCH(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = updateProfileSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, username, bio, image } = parsed.data

  // Check username uniqueness if changed
  if (username) {
    const existing = await db.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        NOT: { id: userId },
      },
    })
    if (existing) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 })
    }
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: {
      ...(name ? { name: name.trim() } : {}),
      ...(username ? { username: username.toLowerCase().trim() } : {}),
      ...(bio !== undefined ? { bio: bio?.trim() || null } : {}),
      ...(image !== undefined ? { image } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      bio: true,
      image: true,
      timezone: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ user: updatedUser })
}
