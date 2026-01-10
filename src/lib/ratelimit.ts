import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Rate limiters for different endpoints
export const chatLimiter = {
  anon: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    prefix: 'ratelimit:chat:anon',
  }),
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    prefix: 'ratelimit:chat:auth',
  }),
}

export const generateLimiter = {
  anon: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    prefix: 'ratelimit:generate:anon',
  }),
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'ratelimit:generate:auth',
  }),
}

export async function checkRateLimit(
  limiter: { anon: Ratelimit; auth: Ratelimit },
  identifier: string,
  isAuthenticated: boolean
): Promise<{ success: boolean; reset: number }> {
  try {
    const rl = isAuthenticated ? limiter.auth : limiter.anon
    const result = await rl.limit(identifier)
    return { success: result.success, reset: result.reset }
  } catch (err) {
    console.error('[RateLimit] Error:', err)
    // Fail open - allow request if rate limiting fails
    return { success: true, reset: Date.now() }
  }
}

export function rateLimitResponse(reset: number): Response {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000)
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
  })
}

// Helper to get identifier from request
export function getIdentifier(req: Request, userId?: string): string {
  if (userId) return userId

  // Try to get IP from headers
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  return `ip:${ip}`
}
