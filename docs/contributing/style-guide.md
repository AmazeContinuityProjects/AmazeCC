# Style Guide

## TypeScript

### General
- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Use `type` for unions, primitives, and complex types
- Avoid `any` - use `unknown` or proper types
- Use `const` assertions for literal types

```typescript
// Good
interface User {
  id: string
  name: string
  email?: string
}

type Status = 'loading' | 'success' | 'error'

const COLORS = ['red', 'blue', 'green'] as const

// Avoid
const data: any = fetchData()
```

### Naming Conventions
| Entity | Convention | Example |
|--------|------------|---------|
| Variables/Functions | camelCase | `userName`, `getUserData` |
| Classes/Interfaces | PascalCase | `User`, `ApiClient` |
| Types | PascalCase | `UserData`, `ApiResponse` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_BASE_URL` |
| Files | kebab-case | `api-client.ts`, `user-profile.tsx` |
| Components | PascalCase | `UserProfile.tsx` |
| Hooks | camelCase + use | `useUserData`, `useAuth` |

### Imports
```typescript
// External first
import { useState, useEffect } from 'react'
import { z } from 'zod'

// Internal with @/ alias
import { apiClient } from '@/lib/api-client'
import { User } from '@/types/user'

// Relative last
import { Button } from './Button'
import { utils } from '../lib/utils'
```

### Type Definitions
```typescript
// API Responses
interface ApiResponse<T> {
  data: T
  meta: {
    cached: boolean
    timestamp: string
  }
}

// Component Props
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  children: React.ReactNode
  className?: string
}

// Use generics for reusable types
interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

## React

### Component Structure
```typescript
'use client'

import { memo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ComponentNameProps {
  // Required props first
  title: string
  data: DataItem[]
  
  // Optional props with defaults
  variant?: 'default' | 'compact'
  onAction?: (id: string) => void
  
  // Standard props last
  className?: string
  children?: React.ReactNode
}

export const ComponentName = memo(function ComponentName({
  title,
  data,
  variant = 'default',
  onAction,
  className,
  children
}: ComponentNameProps) {
  const [localState, setLocalState] = useState(initialValue)
  
  const handleClick = useCallback((id: string) => {
    onAction?.(id)
  }, [onAction])
  
  return (
    <div className={cn('base-styles', variantStyles[variant], className)}>
      <h2>{title}</h2>
      {children}
      {data.map(item => (
        <div key={item.id} onClick={() => handleClick(item.id)}>
          {item.name}
        </div>
      ))}
    </div>
  )
})

ComponentName.displayName = 'ComponentName'
```

### Client vs Server Components
- **Default**: Server Components (no `'use client'`)
- **Add `'use client'`** when using:
  - Hooks (`useState`, `useEffect`, `useContext`)
  - Browser APIs (`window`, `localStorage`, `document`)
  - Event handlers (`onClick`, `onChange`, `onSubmit`)
  - Custom hooks that use the above

### Hooks
```typescript
// Custom hook naming
function useAttendance(semester?: string) {
  // Implementation
}

// Return consistent shape
return {
  data: attendance,
  isLoading,
  isError,
  error,
  refresh: mutate
}
```

### State Management
- **Local state**: `useState`, `useReducer`
- **Context**: For global state (auth, theme, data)
- **Server state**: SWR/React Query via custom hooks
- **URL state**: `useSearchParams`, `useRouter`

## Styling (Tailwind CSS v4)

### Class Organization
```typescript
// Logical grouping
<div className={cn(
  // Layout
  'flex items-center justify-between',
  // Spacing
  'p-4 gap-4',
  // Sizing
  'w-full max-w-2xl',
  // Visual
  'bg-background border border-border rounded-lg',
  // Typography
  'text-foreground',
  // States
  'hover:bg-accent/10 transition-colors',
  // Responsive
  'md:flex-row flex-col',
  // Conditional
  isActive && 'ring-2 ring-accent',
  // Custom
  className
)}>
```

### Design Tokens
Use CSS variables from `globals.css`:
```css
/* Available variables */
--color-primary
--color-accent
--color-background
--color-foreground
--color-border
--color-muted
--color-muted-foreground
--radius-sm
--radius-md
--radius-lg
--font-sans
--font-mono
```

### Dark Mode
```typescript
// Automatic via class strategy
<div className="bg-background text-foreground">
  {/* Automatically adapts to .dark or .midnight class on html */}
</div>

// Manual override if needed
<div className="dark:bg-gray-900 dark:text-gray-100">
```

### Responsive
```typescript
// Mobile-first
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

## API Design

### Endpoint Structure
```
GET    /api/resource           # List
POST   /api/resource           # Create
GET    /api/resource/:id       # Get one
PUT    /api/resource/:id       # Full update
PATCH  /api/resource/:id       # Partial update
DELETE /api/resource/:id       # Delete
```

### Request Validation
```typescript
// Zod schemas
const createResourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.enum(['A', 'B', 'C']),
  tags: z.array(z.string()).optional()
})

// In route handler
const body = await request.json()
const result = createResourceSchema.safeParse(body)
if (!result.success) {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', details: result.error.flatten() },
    { status: 400 }
  )
}
```

### Response Format
```typescript
// Success
{
  "data": { ... },
  "meta": { "cached": true, "timestamp": "..." }
}

// Error
{
  "error": "ERROR_CODE",
  "message": "Human readable",
  "details": { ... }
}

// Pagination
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Codes
| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body/query |
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `VTOP_UNAVAILABLE` | 503 | VTOP portal down |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## File Organization

### Component Files
```
ComponentName/
├── ComponentName.tsx       # Main component
├── ComponentName.types.ts  # Types (if complex)
├── ComponentName.styles.css # CSS modules (rare)
├── index.ts                # Barrel export
└── __tests__/
    └── ComponentName.test.tsx
```

### Hook Files
```
useHookName.ts              # Hook implementation
useHookName.test.ts         # Tests
```

### Utility Files
```
utils.ts                    # General utilities
api-client.ts               # API client
date-utils.ts               # Date helpers
string-utils.ts             # String helpers
```

## Git

### Branches
```
main                    # Production
develop                 # Development (if used)
feat/short-description  # Features
fix/short-description   # Bug fixes
docs/short-description  # Documentation
refactor/short-description
test/short-description
chore/short-description
hotfix/short-description
release/v1.2.0
```

### Commits
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`

## Documentation

### Code Comments
- **Don't** comment obvious code
- **Do** comment complex logic, business rules, workarounds
- Use JSDoc for public APIs

```typescript
/**
 * Calculates attendance percentage
 * @param attended - Classes attended
 * @param total - Total classes
 * @returns Percentage (0-100)
 */
function calculatePercentage(attended: number, total: number): number {
  if (total === 0) return 100
  return Math.round((attended / total) * 100)
}
```

### README/MD Files
- Clear headings
- Code blocks with language
- Tables for structured data
- Links to related docs

## Linting & Formatting

### ESLint
```bash
npm run lint          # Check
npm run lint:fix      # Auto-fix
```

### Prettier
- Runs via ESLint (prettier plugin)
- Configured in `eslint.config.mjs`

### TypeScript
```bash
npm run typecheck     # tsc --noEmit
```

## Performance

### Do
- Use `memo` for components
- Use `useMemo`/`useCallback` for expensive computations
- Lazy load heavy components
- Optimize images with `next/image`
- Use proper cache headers

### Don't
- Inline object creation in render
- Anonymous functions in JSX props
- Unnecessary re-renders
- Large bundles without code splitting

## Accessibility

### Required
- Semantic HTML
- Alt text for images
- Focus indicators
- Color contrast (WCAG AA)
- Keyboard navigation
- ARIA labels where needed

### Testing
```bash
# Test with screen reader
# Tab through all interactive elements
# Check color contrast
```

## Related Documentation

- [Contributing Guide](./pull-request-guide.md)
- [Code of Conduct](./code-of-conduct.md)
- [Development Setup](../guides/development-setup.md)
- [Frontend Development](../guides/frontend-development.md)
- [Backend Development](../guides/backend-development.md)