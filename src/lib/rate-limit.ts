/**
 * In-Memory Sliding Window Rate Limiter
 *
 * NOTE: In-memory rate limiting is isolated to each running Node.js process / serverless instance.
 * It is not shared across multiple distributed instances or cold lambda restarts.
 * For horizontally scaled multi-region production deployments, plug in an external distributed
 * cache such as Upstash Redis (@upstash/ratelimit) using UPSTASH_REDIS_REST_URL.
 */
interface RateLimitRecord {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 60000)
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key)
      }
    }
  }, 300000)
}

export interface RateLimitOptions {
  limit: number       // Max allowed requests in window
  windowMs: number    // Time window in milliseconds
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 60, windowMs: 60000 }
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now()
  const { limit, windowMs } = options

  let record = rateLimitStore.get(identifier)
  if (!record) {
    record = { timestamps: [] }
    rateLimitStore.set(identifier, record)
  }

  // Filter timestamps within the window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs)

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0]
    const resetMs = Math.max(0, windowMs - (now - oldestTimestamp))
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    }
  }

  record.timestamps.push(now)
  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  }
}
