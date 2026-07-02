# Testing Guide

## Test Stack

- **Vitest**: Unit & integration tests
- **React Testing Library**: Component tests
- **Playwright**: E2E tests (optional)
- **MSW**: API mocking (optional)

## Running Tests

```bash
# Unit tests
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report

# E2E tests (if configured)
npm run test:e2e
npm run test:e2e:ui
```

## Test Structure

```
src/
├── __tests__/              # Unit tests (global)
│   ├── utils.test.ts
│   └── attendanceTimetable.test.ts
├── components/
│   └── custom/
│       └── __tests__/     # Component tests
│           ├── AttendanceChart.test.tsx
│           └── StatsCards.test.tsx
├── lib/
│   └── __tests__/         # Library tests
│       ├── api-client.test.ts
│       └── vtop/
│           └── scraper.test.ts
├── app/
│   └── api/
│       └── attendance/
│           └── __tests__/ # API route tests
│               └── route.test.ts
└── hooks/
    └── __tests__/         # Hook tests
        └── useAttendance.test.ts
```

## Unit Testing

### Testing Utilities
```typescript
// src/test/utils.ts
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { DataProvider } from '@/contexts/DataContext'

// Wrapper with all providers
const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <AuthProvider>
      <DataProvider>
        {children}
      </DataProvider>
    </AuthProvider>
  </ThemeProvider>
)

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// Mock API client
export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient
}))
```

### Testing Hooks
```typescript
// src/hooks/__tests__/useAttendance.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { useAttendance } from '../useAttendance'
import { mockApiClient } from '@/test/utils'

describe('useAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches attendance data', async () => {
    const mockData = [
      { subjectCode: 'CSE2001', percentage: 90, attended: 45, total: 50 }
    ]
    
    mockApiClient.get.mockResolvedValue({ data: mockData })
    
    const { result } = renderHook(() => useAttendance())
    
    expect(result.current.isLoading).toBe(true)
    
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    
    expect(result.current.attendance).toEqual(mockData)
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/attendance')
  })

  it('handles error', async () => {
    mockApiClient.get.mockRejectedValue(new Error('Network error'))
    
    const { result } = renderHook(() => useAttendance())
    
    await waitFor(() => expect(result.current.isError).toBe(true))
    
    expect(result.current.isError).toBe(true)
  })
})
```

### Testing Components
```typescript
// src/components/custom/__tests__/AttendanceChart.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { AttendanceChart } from '../AttendanceChart'
import { renderWithProviders } from '@/test/utils'

const mockData = [
  { subjectCode: 'CSE2001', subjectName: 'Data Structures', percentage: 90, attended: 45, total: 50, status: 'SAFE' },
  { subjectCode: 'MAT2001', subjectName: 'Mathematics', percentage: 70, attended: 35, total: 50, status: 'RISK' }
]

describe('AttendanceChart', () => {
  it('renders attendance data', () => {
    renderWithProviders(<AttendanceChart data={mockData} />)
    
    expect(screen.getByText('Data Structures')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('SAFE')).toBeInTheDocument()
  })

  it('shows risk subjects with warning color', () => {
    renderWithProviders(<AttendanceChart data={mockData} />)
    
    const riskRow = screen.getByText('Mathematics').closest('tr')
    expect(riskRow).toHaveClass('bg-red-50') // or appropriate risk styling
  })

  it('calls onSubjectClick when row clicked', () => {
    const handleClick = vi.fn()
    renderWithProviders(<AttendanceChart data={mockData} onSubjectClick={handleClick} />)
    
    fireEvent.click(screen.getByText('Data Structures'))
    
    expect(handleClick).toHaveBeenCalledWith('CSE2001')
  })

  it('shows empty state when no data', () => {
    renderWithProviders(<AttendanceChart data={[]} />)
    
    expect(screen.getByText('No attendance data available')).toBeInTheDocument()
  })
})
```

### Testing API Routes
```typescript
// src/app/api/attendance/__tests__/route.test.ts
import { GET } from '../route'
import { NextRequest } from 'next/server'
import { createMockRequest, mockDb } from '@/test/utils'

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  validateAuth: vi.fn()
}))

vi.mock('@/lib/db', () => ({
  db: mockDb
}))

import { validateAuth } from '@/lib/auth'

describe('GET /api/attendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated request', async () => {
    vi.mocked(validateAuth).mockResolvedValue(null)
    
    const request = createMockRequest('GET', '/api/attendance')
    const response = await GET(request)
    
    expect(response.status).toBe(401)
  })

  it('returns cached data when available', async () => {
    vi.mocked(validateAuth).mockResolvedValue({ userId: 'user_123' })
    mockDb.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { data: [{ subjectCode: 'CSE2001', percentage: 90 }] } 
      })
    })
    
    const request = createMockRequest('GET', '/api/attendance', {
      headers: { Authorization: 'Bearer valid_token' }
    })
    
    const response = await GET(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.meta.cached).toBe(true)
  })

  it('fetches fresh data when cache miss', async () => {
    vi.mocked(validateAuth).mockResolvedValue({ userId: 'user_123' })
    mockDb.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }) // Cache miss
    })
    
    // Mock VTOP scraping
    vi.mock('@/lib/vtop/scraper', () => ({
      scrapeAttendance: vi.fn().mockResolvedValue([
        { subjectCode: 'CSE2001', percentage: 90 }
      ])
    }))
    
    const request = createMockRequest('GET', '/api/attendance', {
      headers: { Authorization: 'Bearer valid_token' }
    })
    
    const response = await GET(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.meta.cached).toBe(false)
  })
})
```

## E2E Testing (Playwright)

### Setup
```bash
npm install -D @playwright/test
npx playwright install
```

### Test Example
```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('http://localhost:3001')
    
    // Click login button
    await page.click('text=Login')
    
    // Fill credentials
    await page.fill('input[name="regNo"]', '21BCE1234')
    await page.fill('input[name="password"]', 'password123')
    await page.fill('input[name="captcha"]', 'A1B2C3')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Wait for redirect
    await page.waitForURL('**/dashboard')
    
    // Verify dashboard loaded
    await expect(page.locator('text=Attendance')).toBeVisible()
  })
  
  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:3001/login')
    
    await page.fill('input[name="regNo"]', '21BCE1234')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.fill('input[name="captcha"]', 'A1B2C3')
    
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })
})
```

## Mocking Strategies

### MSW (Mock Service Worker)
```typescript
// src/test/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('https://api.amazecc.com/api/attendance', () => {
    return HttpResponse.json({
      data: [
        { subjectCode: 'CSE2001', percentage: 90 }
      ]
    })
  }),
  
  http.post('https://api.amazecc.com/api/auth/login', async ({ request }) => {
    const body = await request.json()
    
    if (body.regNo === '21BCE1234' && body.password === 'password') {
      return HttpResponse.json({
        data: {
          token: 'mock_token',
          user: { regNo: '21BCE1234', name: 'Test User' }
        }
      })
    }
    
    return HttpResponse.json(
      { error: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      { status: 401 }
    )
  })
]
```

```typescript
// src/test/setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## Coverage Targets

| Category | Target |
|----------|--------|
| Statements | 80% |
| Branches | 70% |
| Functions | 80% |
| Lines | 80% |

### Coverage Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      },
      exclude: [
        'node_modules/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        'src/app/**', // Next.js pages
        'src/components/ui/**' // Radix wrappers
      ]
    }
  }
})
```

## CI Integration

### GitHub Actions
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Test what the user sees/experiences
   - Avoid testing internal state

2. **Use Descriptive Test Names**
   ```typescript
   // Good
   it('shows error message when login fails with invalid password')
   
   // Avoid
   it('handles login error')
   ```

3. **Arrange-Act-Assert Pattern**
   ```typescript
   it('calculates attendance percentage correctly', () => {
     // Arrange
     const attended = 45
     const total = 50
     
     // Act
     const percentage = calculatePercentage(attended, total)
     
     // Assert
     expect(percentage).toBe(90)
   })
   ```

4. **One Assertion Per Test** (when possible)
5. **Mock External Dependencies** (API, DB, time)
6. **Test Edge Cases** (empty data, errors, loading states)

## Related Documentation

- [Development Setup](./development-setup.md)
- [Frontend Development](./frontend-development.md)
- [Backend Development](./backend-development.md)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)