import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { z } from 'zod'

const updatePrefsSchema = z.object({
  messages: z.boolean().optional(),
  mentions: z.boolean().optional(),
  taskAssignments: z.boolean().optional(),
  taskDue: z.boolean().optional(),
  events: z.boolean().optional(),
  fileShared: z.boolean().optional(),
  documentUpdated: z.boolean().optional(),
})

// GET /api/settings/notifications — get notification preferences
export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  const prefs = await db.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })

  return NextResponse.json({ preferences: prefs })
}

// PATCH /api/settings/notifications — update notification preferences
export async function PATCH(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id
  const body = await req.json()
  const parsed = updatePrefsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const prefs = await db.notificationPreference.upsert({
    where: { userId },
    update: parsed.data,
    create: {
      userId,
      ...parsed.data,
    },
  })

  return NextResponse.json({ preferences: prefs })
}
