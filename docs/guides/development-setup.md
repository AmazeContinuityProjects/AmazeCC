# Development Setup Guide

## Detailed Environment Configuration

### Frontend Environment Variables (`.env.local`)

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.amazecc.com

# Feature Flags
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# External Services (Client-side)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### Backend Environment Variables (`.env.local` or server environment)

```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
JWT_SECRET=your-256-bit-base64-secret-key-here
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Admin
ADMIN_TOKEN=your-secure-admin-token

# VTOP Scraping
VTOP_BASE_URL=https://vtop.vit.ac.in
CAPTCHA_SOLVER_API_KEY=your_2captcha_or_anticaptcha_key
SCRAPING_DELAY_MS=1000
MAX_CONCURRENT_SCRAPES=10

# External Storage (Backblaze B2)
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_BUCKET_NAME=amazecc-assets
B2_ACCESS_KEY_ID=your_key_id
B2_SECRET_ACCESS_KEY=your_secret_key
B2_REGION=us-west-004

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=AmazeCC <noreply@amazecc.com>

# Push Notifications (VAPID)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@amazecc.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Feature Flags
ENABLE_CACHE=true
CACHE_TTL_SECONDS=300
ENABLE_RATE_LIMITING=true
```

## Database Setup (Supabase)

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Note down URL and keys

### 2. Run Migrations
```bash
# Option A: Supabase CLI (recommended)
supabase login
supabase link --project-ref your-project-ref
supabase db push

# Option B: Direct SQL
psql $DATABASE_URL -f supabase_setup.sql
psql $DATABASE_URL -f migrate.sql
```

### 3. Enable Row Level Security
Run in Supabase SQL Editor:
```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
-- ... repeat for all tables

-- Create policies (see docs/architecture/database.md)
```

## Local Development with Docker

### Docker Compose (Optional)
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/amazec
    depends_on:
      - db
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:16
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=amazec
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Run with Docker
```bash
docker-compose up -d
docker-compose logs -f app
```

## Debugging

### Frontend Debugging (VS Code)

**`.vscode/launch.json`:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: Debug",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### Backend Debugging

API routes run in the same Next.js process. Add breakpoints in `src/app/api/**/route.ts`.

### Logging

```typescript
// src/lib/logger.ts
import { createLogger } from 'winston'

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
})
```

## Testing Setup

### Unit Tests (Vitest)
```bash
npm run test           # Run once
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### E2E Tests (Playwright - if configured)
```bash
npm run test:e2e
npm run test:e2e:ui
```

### Test Database
Use a separate test database or Supabase branch:
```env
# .env.test
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres_test
```

## Performance Profiling

### Next.js Bundle Analyzer
```bash
ANALYZE=true npm run build
# Opens browser with bundle analysis
```

### React DevTools Profiler
1. Install React DevTools browser extension
2. Open DevTools → Profiler tab
3. Record interactions

### Database Query Analysis
```sql
-- Enable query logging in Supabase
-- Or use pg_stat_statements
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 20;
```

## Common Development Tasks

### Adding a New API Endpoint
1. Create `src/app/api/your-endpoint/route.ts`
2. Add validation schema (Zod)
3. Implement handler with auth check
4. Add types to `src/types/`
5. Write tests
6. Update API docs

### Adding a New Component
1. Create component in `src/components/custom/` or `src/components/ui/`
2. Add TypeScript props interface
3. Export from index.ts if needed
4. Add stories (if using Storybook)
5. Write tests

### Database Schema Changes
1. Create migration SQL file
2. Run locally: `psql $DATABASE_URL -f migration.sql`
3. Update TypeScript types
4. Update Supabase via CLI or dashboard
5. Deploy migration with code

## Troubleshooting

### "Cannot find module" Errors
```bash
# Clear TypeScript cache
npx tsc --build --clean
# Rebuild
npm run build
```

### Hydration Mismatches
- Check for browser-only APIs in SSR components
- Use `useEffect` for client-only code
- Use `dynamic` import with `ssr: false`

### VTOP Scraping Failures
- Check VTOP status manually
- Verify captcha solver API
- Check cookie encryption/decryption
- Review scraping delay settings

## Related Documentation

- [Getting Started](../getting-started.md)
- [Frontend Development](./frontend-development.md)
- [Backend Development](./backend-development.md)
- [Testing Guide](./testing.md)
- [Architecture Overview](../architecture/overview.md)