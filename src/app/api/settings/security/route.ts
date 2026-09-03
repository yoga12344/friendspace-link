import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/workspace-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
})

// PATCH /api/settings/security — update user password
export async function PATCH(req: Request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const userId = session!.user.id

  // Rate limit: max 5 password attempts per minute per user
  const rate = checkRateLimit(`security:${userId}`, { limit: 5, windowMs: 60000 })
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many password attempts. Please try again later.' },
      { status: 429 }
    )
  }
  const body = await req.json()
  const parsed = passwordSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 })
  }

  // Fetch current user hashed password
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, hashedPassword: true },
  })

  if (!user || !user.hashedPassword) {
    return NextResponse.json(
      { error: 'Cannot change password for this account type' },
      { status: 400 }
    )
  }

  const isValid = await bcrypt.compare(currentPassword, user.hashedPassword)
  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  const newHashedPassword = await bcrypt.hash(newPassword, 12)

  await db.user.update({
    where: { id: userId },
    data: { hashedPassword: newHashedPassword },
  })

  return NextResponse.json({ success: true, message: 'Password updated successfully' })
}
