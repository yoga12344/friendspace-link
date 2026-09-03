import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { registerSchema } from '@/lib/validations/auth'


export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      )
    }

    const { name, username, email, password } = parsed.data

    const existingEmail = await db.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_TAKEN',
            message: 'An account with this email already exists.',
          },
        },
        { status: 409 }
      )
    }

    const existingUsername = await db.user.findUnique({ where: { username } })
    if (existingUsername) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USERNAME_TAKEN',
            message: 'This username is already taken.',
          },
        },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await db.user.create({
      data: { name, username, email, hashedPassword },
      select: { id: true, email: true, name: true, username: true },
    })

    return NextResponse.json({ success: true, data: { user } }, { status: 201 })
  } catch (error) {
    console.error('[REGISTER_ERROR]', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
