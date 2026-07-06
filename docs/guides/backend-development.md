# Backend Development Guide

## API Route Structure

### Route Handler Template
```typescript
// src/app/api/your-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAuth } from '@/lib/auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// Request validation schema
const requestSchema = z.object({
  param1: z.string(),
  param2: z.number().optional()
})

export async function GET(request: NextRequest) {
  try {
    // 1. Validate authentication
    const auth = await validateAuth(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // 2. Parse and validate query params
    const searchParams = request.nextUrl.searchParams
    const query = {
      param1: searchParams.get('param1'),
      param2: searchParams.get('param2') ? Number(searchParams.get('param2')) : undefined
    }
    
    const validation = requestSchema.safeParse(query)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid parameters', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // 3. Check cache
    const cacheKey = `endpoint:${auth.userId}:${JSON.stringify(query)}`
    const cached = await getCache(cacheKey)
    if (cached) {
      return NextResponse.json(
        { data: cached, meta: { cached: true, timestamp: new Date().toISOString() } },
        { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } }
      )
    }

    // 4. Fetch data (scrape VTOP or query DB)
    const data = await fetchData(auth.userId, validation.data)

    // 5. Cache result
    await setCache(cacheKey, data, 300) // 5 min TTL

    // 6. Return response
    return NextResponse.json(
      { data, meta: { cached: false, timestamp: new Date().toISOString() } },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } }
    )

  } catch (error) {
    logger.error('API Error', { endpoint: '/api/your-endpoint', error })
    
    if (error instanceof VTOPError) {
      return NextResponse.json(
        { error: 'VTOP_UNAVAILABLE', message: 'VTOP portal is currently unavailable' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500 }
    }
  }
}

export async function POST(request: NextRequest) {
  // Similar structure for POST
  // Use request.json() for body parsing
}
```

## VTOP Scraping

### Session Management
```typescript
// src/lib/vtop/session.ts
import { CookieJar } from 'tough-cookie'
import { encrypt, decrypt } from '@/lib/crypto'

interface VTOPSession {
  jar: CookieJar
  sessionId: string
  expiresAt: number
}

export async function getVTopsession(userId: string): Promise<VTOPSession> {
  // 1. Check database for existing session
  const stored = await db.session.findUnique({ where: { userId } })
  
  if (stored && stored.expiresAt > Date.now()) {
    const jar = new CookieJar()
    const cookies = decrypt(stored.encryptedCookies)
    await jar.setCookiesSync(cookies, VTOP_BASE_URL)
    return { jar, sessionId: stored.sessionId, expiresAt: stored.expiresAt }
  }

  // 2. Create new session (requires login)
  const jar = new CookieJar()
  await loginToVTOP(jar, userId)
  
  // 3. Save session
  const encrypted = encrypt(JSON.stringify(await jar.getCookiesSync(VTOP_BASE_URL)))
  await db.session.upsert({
    where: { userId },
    create: { userId, encryptedCookies: encrypted, sessionId: generateId(), expiresAt: Date.now() + 3600000 },
    update: { encryptedCookies: encrypted, expiresAt: Date.now() + 3600000 }
  })

  return { jar, sessionId: generateId(), expiresAt: Date.now() + 3600000 }
}
```

### Scraping Utility
```typescript
// src/lib/vtop/scraper.ts
import * as cheerio from 'cheerio'
import { getVTopsession } from './session'

export async function scrapeAttendance(userId: string): Promise<AttendanceData[]> {
  const { jar } = await getVTopsession(userId)
  
  const response = await fetch(`${VTOP_BASE_URL}/student/attendance`, {
    headers: { Cookie: jar.getCookieStringSync(VTOP_BASE_URL) }
  })
  
  const html = await response.text()
  const $ = cheerio.load(html)
  
  // Robust selectors with fallbacks
  const rows = $('#attendanceTable tbody tr, table[id*="attendance"] tbody tr')
  
  return rows.map((_, row) => {
    const $row = $(row)
    return {
      subjectCode: $row.find('td:nth-child(1)').text().trim(),
      subjectName: $row.find('td:nth-child(2)').text().trim(),
      attended: parseInt($row.find('td:nth-child(3)').text().trim()),
      total: parseInt($row.find('td:nth-child(4)').text().trim()),
      percentage: parseFloat($row.find('td:nth-child(5)').text().replace('%', ''))
    }
  }).get()
}
```

## Database Operations

### Supabase Client
```typescript
// src/lib/db.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

// Types for tables
export type User = {
  id: string
  reg_no: string
  name: string
  email: string | null
  // ...
}
```

### Repository Pattern
```typescript
// src/repositories/userRepository.ts
import { db } from '@/lib/db'

export const userRepository = {
  async findById(id: string) {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async findByRegNo(regNo: string) {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('reg_no', regNo)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error // Not found
    return data
  },

  async upsert(user: Partial<User>) {
    const { data, error } = await db
      .from('users')
      .upsert(user, { onConflict: 'id' })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateTokenHash(userId: string, tokenHash: string) {
    const { error } = await db
      .from('users')
      .update({ token_hash: tokenHash, updated_at: new Date().toISOString() })
      .eq('id', userId)
    
    if (error) throw error
  }
}
```

## Caching

### Cache Service
```typescript
// src/lib/cache.ts
import { db } from '@/lib/db'

export async function getCache(key: string): Promise<any | null> {
  const { data } = await db
    .from('cached_data')
    .select('data, expires_at')
    .eq('cache_key', key)
    .gt('expires_at', new Date().toISOString())
    .single()
  
  return data?.data ?? null
}

export async function setCache(key: string, data: any, ttlSeconds: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  
  await db
    .from('cached_data')
    .upsert({
      cache_key: key,
      data,
      expires_at: expiresAt,
      updated_at: new Date().toISOString()
    }, { onConflict: 'cache_key' })
}

export async function invalidateCache(pattern: string): Promise<void> {
  // Delete keys matching pattern (requires Postgres function or manual)
  await db.rpc('invalidate_cache_pattern', { pattern })
}
```

## Error Handling

### Custom Error Classes
```typescript
// src/lib/errors.ts
export class VTOPError extends Error {
  constructor(message: string, public statusCode: number = 503) {
    super(message)
    this.name = 'VTOPError'
  }
}

export class ValidationError extends Error {
  constructor(public errors: any) {
    super('Validation failed')
    this.name = 'ValidationError'
  }
}

export class AuthError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message)
    this.name = 'AuthError'
  }
}
```

### Global Error Handler
```typescript
// src/app/api/[[...route]]/route.ts (or middleware)
import { NextRequest, NextResponse } from 'next/server'

export async function handleApiError(error: unknown, request: NextRequest) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Invalid request', details: error.errors },
      { status: 400 }
    )
  }
  
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: error.message },
      { status: 401 }
    )
  }
  
  if (error instanceof VTOPError) {
    return NextResponse.json(
      { error: 'VTOP_UNAVAILABLE', message: error.message },
      { status: error.statusCode }
    )
  }
  
  // Log unexpected errors
  logger.error('Unhandled API error', { error, url: request.url })
  
  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    { status: 500 }
  )
}
```

## Rate Limiting

### Rate Limiter
```typescript
// src/lib/rate-limiter.ts
import { db } from '@/lib/db'

const WINDOW_MS = 60000 // 1 minute
const MAX_REQUESTS = 60

export async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${identifier}`
  const now = Date.now()
  const windowStart = now - WINDOW_MS
  
  // Use Redis or database for distributed rate limiting
  // This is a simplified in-memory version for single instance
  
  const current = await db.rpc('increment_rate_limit', {
    key,
    window_start: new Date(windowStart).toISOString(),
    window_ms: WINDOW_MS
  })
  
  return {
    allowed: current.count <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - current.count),
    resetAt: now + WINDOW_MS
  }
}
```

## Testing API Routes

### Integration Test
```typescript
// src/app/api/attendance/__tests__/route.test.ts
import { GET } from '../route'
import { NextRequest } from 'next/server'
import { createMockRequest } from '@/test/utils'

describe('GET /api/attendance', () => {
  it('returns attendance data for authenticated user', async () => {
    const request = createMockRequest('GET', '/api/attendance', {
      headers: { Authorization: 'Bearer valid_token' }
    })
    
    const response = await GET(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.data).toBeDefined()
    expect(Array.isArray(data.data)).toBe(true)
  })
  
  it('returns 401 for invalid token', async () => {
    const request = createMockRequest('GET', '/api/attendance', {
      headers: { Authorization: 'Bearer invalid_token' }
    })
    
    const response = await GET(request)
    expect(response.status).toBe(401)
  })
})
```

## Logging

### Structured Logging
```typescript
// src/lib/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'amazec-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
})

// Usage
logger.info('API Request', { 
  endpoint: '/api/attendance', 
  userId: 'user_123', 
  duration: 1250,
  cached: true 
})

logger.error('VTOP Scraping Failed', {
  endpoint: '/api/attendance',
  userId: 'user_123',
  error: error.message,
  stack: error.stack
})
```

## Related Documentation

- [Development Setup](./development-setup.md)
- [Frontend Development](./frontend-development.md)
- [Architecture: Backend](../architecture/backend.md)
- [Database Design](../architecture/database.md)
- [API Overview](../api/overview.md)