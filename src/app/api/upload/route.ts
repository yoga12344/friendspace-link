import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/workspace-auth'
import { saveLocalFile } from '@/lib/storage'

export async function POST(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const uploaded = await saveLocalFile(file, file.name)
    return NextResponse.json({ success: true, file: uploaded })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
