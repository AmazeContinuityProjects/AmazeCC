# Frontend Development Guide

## Component Structure

### Page Components (App Router)
```
src/app/
├── page.tsx                    # Landing page
├── layout.tsx                  # Root layout
├── globals.css                 # Global styles
├── dashboard/
│   ├── page.tsx               # Dashboard entry
│   ├── attendance/page.tsx    # Attendance page
│   ├── marks/page.tsx         # Marks page
│   └── ...
├── api/                       # API routes (if needed)
└── components/                # Page-specific components
```

### Reusable Components
```
src/components/
├── ui/                        # Radix UI wrappers (primitives)
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── tabs.tsx
│   ├── toast.tsx
│   ├── tooltip.tsx
│   └── ...
├── custom/                    # Business logic components
│   ├── Main.tsx              # Main dashboard
│   ├── NavigationTabs.tsx
│   ├── StatsCards.tsx
│   ├── CommandPalette.tsx
│   ├── AttendanceChart.tsx
│   ├── MarksTable.tsx
│   └── ...
├── theme/
│   └── ThemeProvider.tsx
├── providers/
│   ├── AuthProvider.tsx
│   └── DataProvider.tsx
└── index.ts                   # Barrel exports
```

## Component Guidelines

### 1. Component Naming
- **PascalCase** for component files: `AttendanceChart.tsx`
- **Default export** for main component
- **Named exports** for sub-components/types

### 2. TypeScript Props Interface
```typescript
// Good
interface AttendanceChartProps {
  data: AttendanceData[]
  subjectCode?: string
  onSubjectClick?: (code: string) => void
  className?: string
}

// Avoid: Using 'any' or inline types
```

### 3. Component Template
```typescript
'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'

interface ComponentNameProps {
  // Props here
}

export const ComponentName = memo(function ComponentName({
  className,
  ...props
}: ComponentNameProps) {
  return (
    <div className={cn('base-styles', className)}>
      {/* JSX */}
    </div>
  )
})

ComponentName.displayName = 'ComponentName'
```

### 4. Client vs Server Components
- **Default**: Server Components (no `'use client'`)
- **Add `'use client'`** when using:
  - `useState`, `useEffect`, `useContext`
  - Browser APIs (`window`, `localStorage`)
  - Event handlers (`onClick`, `onChange`)
  - Custom hooks that use the above

## State Management

### Context Pattern
```typescript
// src/contexts/AuthContext.tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthContextType {
  user: User | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  
  // ... implementation
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

### Server State (SWR/React Query)
```typescript
// src/hooks/useAttendance.ts
import useSWR from 'swr'
import { apiClient } from '@/lib/api-client'

export function useAttendance(semester?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    semester ? `/api/attendance?semester=${semester}` : '/api/attendance',
    (url) => apiClient.get(url)
  )
  
  return {
    attendance: data?.data,
    isLoading,
    isError: error,
    refresh: mutate
  }
}
```

## Styling with Tailwind CSS v4

### CSS Variables (globals.css)
```css
@import "tailwindcss";

@theme {
  --color-primary: #1a1a2e;
  --color-accent: #00d4aa;
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
}

.dark {
  --color-background: #0a0a0a;
  --color-foreground: #fafafa;
}

.midnight {
  --color-background: #020617;
  --color-foreground: #e2e8f0;
}
```

### Component Styling
```typescript
// Use Tailwind classes
<div className="flex items-center justify-between p-4 bg-background border border-border rounded-lg">

// Conditional classes with cn utility
<div className={cn(
  'base-styles',
  isActive && 'active-styles',
  variant === 'primary' && 'primary-styles',
  className
)}>

// Dark mode
<div className="bg-background dark:bg-gray-900">
```

## Data Fetching Patterns

### Server Components (Default)
```typescript
// src/app/dashboard/attendance/page.tsx
import { getAttendance } from '@/lib/api-server'
import { AttendanceView } from '@/components/custom/AttendanceView'

export default async function AttendancePage({
  searchParams
}: {
  searchParams: { semester?: string }
}) {
  const attendance = await getAttendance(searchParams.semester)
  
  return <AttendanceView data={attendance} />
}
```

### Client Components (Interactive)
```typescript
// src/components/custom/AttendanceView.tsx
'use client'

import { useAttendance } from '@/hooks/useAttendance'

export function AttendanceView({ initialData }: { initialData: AttendanceData[] }) {
  const { attendance, isLoading, refresh } = useAttendance()
  
  const data = attendance ?? initialData
  
  if (isLoading && !initialData) return <Skeleton />
  
  return <AttendanceTable data={data} onRefresh={refresh} />
}
```

## Forms Handling

### React Hook Form + Zod
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const loginSchema = z.object({
  regNo: z.string().regex(/^\d{2}[A-Z]{3}\d{4}$/, 'Invalid registration number'),
  password: z.string().min(1, 'Password required'),
  captcha: z.string().length(6, 'Captcha must be 6 characters')
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  })
  
  const onSubmit = async (data: LoginForm) => {
    await login(data)
  }
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('regNo')} />
      {errors.regNo && <span>{errors.regNo.message}</span>}
      {/* ... */}
    </form>
  )
}
```

## Performance Optimization

### Code Splitting
```typescript
// Lazy load heavy components
import { lazy, Suspense } from 'react'

const HeavyChart = lazy(() => import('./HeavyChart').then(m => ({ default: m.HeavyChart })))

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart />
    </Suspense>
  )
}
```

### Image Optimization
```typescript
import Image from 'next/image'

<Image
  src="/hero-artwork.png"
  alt="AmazeCC"
  width={1200}
  height={600}
  priority // For above-fold images
  placeholder="blur"
  blurDataURL="data:image/png;base64,..."
/>
```

### Memoization
```typescript
import { memo, useMemo, useCallback } from 'react'

// Component memoization
export const ExpensiveComponent = memo(function ExpensiveComponent({ data, onAction }) {
  // ...
})

// Value memoization
const sortedData = useMemo(() => 
  data.sort((a, b) => b.value - a.value), 
  [data]
)

// Callback memoization
const handleClick = useCallback((id: string) => {
  onAction(id)
}, [onAction])
```

## Accessibility

### Semantic HTML
```typescript
// Use proper heading hierarchy
<h1>Main Title</h1>
<h2>Section Title</h2>

// Use landmarks
<main>
  <nav aria-label="Main navigation">...</nav>
  <section aria-labelledby="attendance-heading">...</section>
</main>
```

### ARIA Attributes
```typescript
<button
  aria-expanded={isOpen}
  aria-controls="dropdown-menu"
  aria-haspopup="true"
>
  Menu
</button>

<div
  id="dropdown-menu"
  role="menu"
  aria-orientation="vertical"
>
  <div role="menuitem">Option 1</div>
</div>
```

### Focus Management
```typescript
import { useEffect, useRef } from 'react'

function Modal({ isOpen, onClose }: ModalProps) {
  const previousFocus = useRef<HTMLElement | null>(null)
  
  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement
      // Focus first focusable element
      modalRef.current?.focus()
    } else {
      previousFocus.current?.focus()
    }
  }, [isOpen])
  
  // Trap focus within modal
}
```

## Testing Components

### Unit Test Example
```typescript
// src/components/custom/__tests__/AttendanceChart.test.tsx
import { render, screen } from '@testing-library/react'
import { AttendanceChart } from '../AttendanceChart'

const mockData = [
  { subjectCode: 'CSE2001', percentage: 90, attended: 45, total: 50 }
]

describe('AttendanceChart', () => {
  it('renders attendance data', () => {
    render(<AttendanceChart data={mockData} />)
    
    expect(screen.getByText('CSE2001')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })
  
  it('calls onSubjectClick when subject clicked', () => {
    const handleClick = vi.fn()
    render(<AttendanceChart data={mockData} onSubjectClick={handleClick} />)
    
    fireEvent.click(screen.getByText('CSE2001'))
    expect(handleClick).toHaveBeenCalledWith('CSE2001')
  })
})
```

## Related Documentation

- [Development Setup](./development-setup.md)
- [Backend Development](./backend-development.md)
- [Component Library](../architecture/frontend.md)
- [Testing Guide](./testing.md)