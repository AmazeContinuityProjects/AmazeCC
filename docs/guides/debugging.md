# Debugging Guide

## Common Issues & Solutions

### 1. Build Errors

#### TypeScript Errors
```bash
# Run type check
npm run typecheck

# Common fixes:
# - Add missing type definitions
# - Fix import paths (use @/ alias)
# - Check for undefined/null handling
```

#### Module Resolution
```bash
# Clear caches
rm -rf .next node_modules/.cache
npm run build
```

### 2. Runtime Errors

#### Hydration Mismatch
**Symptom:** `Warning: Text content did not match` or `Hydration failed`

**Causes:**
- Browser-only APIs in server components
- Random values (`Date.now()`, `Math.random()`)
- Browser extensions modifying DOM

**Solutions:**
```typescript
// Use useEffect for client-only code
'use client'
import { useEffect, useState } from 'react'

function MyComponent() {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => setMounted(true), [])
  
  if (!mounted) return <Skeleton />
  
  return <div>{window.innerWidth}</div> // Safe now
}

// Or use dynamic import
import dynamic from 'next/dynamic'
const ClientOnlyComponent = dynamic(() => import('./ClientOnly'), { ssr: false })
```

#### Window/Document Undefined
```typescript
// Check before using
if (typeof window !== 'undefined') {
  // Safe to use window
  localStorage.setItem('key', 'value')
}

// Or use try-catch
try {
  const theme = localStorage.getItem('theme')
} catch {
  // localStorage not available (SSR)
}
```

### 3. API Issues

#### 401 Unauthorized
**Check:**
- Token expired? → Implement refresh flow
- Token format? → Verify HMAC signature
- VTOP session expired? → Auto-re-login

```typescript
// Debug token
console.log('Token:', token)
console.log('Payload:', JSON.parse(atob(token.split('.')[0])))
```

#### 503 VTOP Unavailable
**Check:**
- VTOP status page
- Captcha solver API
- Network connectivity
- Cookie encryption/decryption

```bash
# Test VTOP manually
curl -v https://vtop.vit.ac.in
```

#### CORS Errors
**Check:** `next.config.mjs` headers
```javascript
// next.config.mjs
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
      ]
    }
  ]
}
```

### 4. Styling Issues

#### Tailwind Classes Not Applying
```bash
# Check content paths in CSS
@import "tailwindcss";
@source "../src/**/*.{js,ts,jsx,tsx}";

# Rebuild
npm run dev
```

#### Dark Mode Not Working
```typescript
// Check class strategy in globals.css
@custom-variant dark (&:where(.dark, .dark *));

// Verify theme class on html element
document.documentElement.classList.contains('dark')
```

### 5. Database Issues

#### Connection Errors
```bash
# Check Supabase status
# Verify DATABASE_URL format
postgresql://user:password@host:5432/database?sslmode=require

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

#### RLS Policy Errors
```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Test as specific user
SET ROLE authenticated;
SELECT * FROM users WHERE id = auth.uid();
```

### 6. Performance Issues

#### Slow Page Loads
```bash
# Analyze bundle
ANALYZE=true npm run build

# Check for:
# - Large dependencies (use bundle analyzer)
# - Unnecessary re-renders (React DevTools Profiler)
# - Missing memoization
# - Large images (use next/image)
```

#### Slow API Responses
```typescript
// Add timing logs
const start = Date.now()
const data = await fetchData()
console.log(`API took ${Date.now() - start}ms`)

// Check:
// - Database query performance (EXPLAIN ANALYZE)
// - VTOP scraping time
// - Cache hit rate
// - N+1 query problems
```

## Debugging Tools

### VS Code Debugging

**Launch Config (`.vscode/launch.json`):**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: Debug Full Stack",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: Debug Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Vitest: Debug Current File",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${relativeFile}"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### Browser DevTools

#### React DevTools
- **Components**: Inspect props, state, hooks
- **Profiler**: Record and analyze renders
- **Highlight updates**: Visualize re-renders

#### Network Tab
- Monitor API requests/responses
- Check headers, timing, payloads
- Filter by `/api/`

#### Application Tab
- Inspect localStorage, sessionStorage, cookies
- Check service worker status
- View PWA manifest

#### Console
```javascript
// Useful snippets
// Get React fiber for element
__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.get(1).findFiberByHostInstance(element)

// Log all API calls
const originalFetch = fetch
window.fetch = (...args) => {
  console.log('FETCH:', args[0])
  return originalFetch(...args)
}
```

### Database Debugging

#### Supabase Dashboard
- **Table Editor**: View/edit data
- **SQL Editor**: Run queries
- **Logs**: API, Auth, Realtime, Database logs
- **Advisors**: Performance recommendations

#### Query Analysis
```sql
-- Slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 20;

-- Missing indexes
SELECT * FROM pg_stat_user_tables 
WHERE seq_scan > idx_scan AND n_tup_ins > 1000;

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Logging

#### Structured Logs
```typescript
// Server logs
logger.info('Request completed', {
  method: 'GET',
  path: '/api/attendance',
  userId: 'user_123',
  statusCode: 200,
  duration: 1250,
  cached: true
})

// Filter in log aggregator (Datadog, Logtail, etc.)
// service:amazec-api AND duration:>1000
```

#### Client-Side Logging
```typescript
// src/lib/client-logger.ts
const isDev = process.env.NODE_ENV === 'development'

export const clientLogger = {
  info: (message: string, meta?: any) => {
    if (isDev) console.log(`[INFO] ${message}`, meta)
  },
  error: (message: string, error?: Error, meta?: any) => {
    console.error(`[ERROR] ${message}`, error, meta)
    // Send to error tracking (Sentry, etc.)
  }
}
```

## Debugging Workflows

### API Debugging Flow
```
1. Check browser Network tab
   ↓
2. Verify request headers (Auth token)
   ↓
3. Check response status & body
   ↓
4. Check server logs (terminal)
   ↓
5. Add debug logs in API route
   ↓
6. Test with curl/Postman
   ↓
7. Check database directly
```

### Frontend Bug Flow
```
1. Reproduce in browser
   ↓
2. Open React DevTools
   ↓
3. Inspect component props/state
   ↓
4. Check console for errors
   ↓
5. Add breakpoints in VS Code
   ↓
6. Check network for failed requests
   ↓
7. Verify data flow (hooks → components)
```

### Database Bug Flow
```
1. Check Supabase logs
   ↓
2. Run query in SQL Editor
   ↓
3. Verify RLS policies
   ↓
4. Check migrations applied
   ↓
5. Verify data types match TypeScript
```

## Useful Commands

```bash
# Clear all caches
rm -rf .next node_modules/.cache
npm run dev

# Reset database (dev only)
psql $DATABASE_URL -f reset.sql

# View logs
tail -f logs/combined.log

# Check TypeScript errors
npx tsc --noEmit

# Lint specific file
npx eslint src/components/custom/Main.tsx

# Test specific file
npx vitest run src/lib/utils.test.ts

# Build with analysis
ANALYZE=true npm run build
```

## Getting Help

1. **Search existing issues** on GitHub
2. **Check documentation** in `/docs`
3. **Ask in Discussions** for questions
4. **Create issue** with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment (OS, Node version, browser)
   - Relevant logs/screenshots
   - Minimal reproduction if possible

## Related Documentation

- [Development Setup](./development-setup.md)
- [Frontend Development](./frontend-development.md)
- [Backend Development](./backend-development.md)
- [Testing Guide](./testing.md)