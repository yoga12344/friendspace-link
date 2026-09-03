import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { z } from 'zod'

const updatePreferencesSchema = z.object({
  timezone: z.string().min(1).max(50).optional(),
})

// GET /api/settings/preferences — get user preferences
export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const user = await db.user.findUnique({
    where: { id: session!.user.id },
    select: { timezone: true },
  })

  return NextResponse.json({ preferences: user })
}

// PATCH /api/settings/preferences — update user preferences
export async function PATCH(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = updatePreferencesSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: parsed.data,
    select: { timezone: true },
  })

  return NextResponse.json({ preferences: updated })
}
