import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/health — minimal public health check for load balancers and deployment platforms
export async function GET() {
  try {
    // Verify database connectivity
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    // Minimal error response, never expose internal DB details or stack traces
    console.error('Health check failed:', error)
    return NextResponse.json({ status: 'error' }, { status: 503 })
  }
}
