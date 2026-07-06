# Frontend Architecture

## Overview

The frontend is built with Next.js 16 App Router, TypeScript, Tailwind CSS v4, and Radix UI primitives.

## Directory Structure

```
src/
├── app/                    # App Router pages & layouts
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Landing page
│   ├── globals.css        # Global styles & Tailwind
│   ├── dashboard/         # Main dashboard pages
│   ├── api/               # Frontend API routes (if any)
│   ├── privacy/           # Privacy policy page
│   ├── ~offline/          # Offline fallback page
│   └── ...                # Other route groups
├── components/            # React components
│   ├── ui/                # Radix UI primitive wrappers
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   ├── custom/            # Custom business components
│   │   ├── Main.tsx       # Main dashboard component
│   │   ├── NavigationTabs.tsx
│   │   ├── StatsCards.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── AttendanceChart.tsx
│   │   ├── MarksTable.tsx
│   │   └── ...
│   ├── theme/             # Theme system
│   │   └── ThemeProvider.tsx
│   └── providers/         # Context providers
│       ├── AuthProvider.tsx
│       └── DataProvider.tsx
├── lib/                   # Utility libraries
│   ├── utils.ts           # General utilities
│   ├── api-client.ts      # API client with auth
│   ├── string-similarity.ts
│   ├── attendanceTimetable.ts
│   ├── marksSync.ts
│   ├── exportTimetable.ts
│   ├── exportIcal.ts
│   ├── analyzeCalendar.ts
│   ├── pastDataSync.ts
│   ├── socialUtils.ts
│   └── activit-tree.ts
├── hooks/                 # Custom React hooks
│   ├── useAuth.ts
│   ├── useTheme.ts
│   ├── useAttendance.ts
│   └── ...
├── types/                 # TypeScript types
│   ├── global.d.ts
│   ├── custom.d.ts
│   ├── components/
│   │   └── props.d.ts
│   └── data/
│       ├── attendance.d.ts
│       ├── marks.d.ts
│       ├── grades.d.ts
│       ├── schedule.d.ts
│       ├── hostel.d.ts
│       ├── login.d.ts
│       ├── eventhub.ts
│       ├── semTT.d.ts
│       └── allgrades.d.ts
├── data/                  # Static data files
│   ├── team.json
│   ├── changelog.json
│   ├── demoData.json
│   ├── campus/
│   │   ├── chennai.json
│   │   ├── bhopal.json
│   │   └── ap.json
│   ├── quickLinks.json
│   └── dayscholar_buses.json
├── __tests__/             # Test files
│   ├── utils.test.ts
│   └── attendanceTimetable.test.ts
├── app/                   # Special Next.js files
│   ├── sw.ts              # Service worker
│   ├── pushNotificationManager.tsx
│   ├── error.tsx          # Error boundary
│   ├── global-error.tsx   # Global error boundary
│   └── not-found.tsx      # 404 page
└── middleware.ts          # Next.js middleware (if exists)
```

## Key Components

### Main Dashboard (`src/components/custom/Main.tsx`)
- Entry point for authenticated users
- Manages global state (user, theme, navigation)
- Renders NavigationTabs and sub-tab content
- Handles command palette (`⌘K`)
- API base configuration

### Navigation Tabs (`src/components/custom/NavigationTabs.tsx`)
- Desktop sidebar + mobile bottom navigation
- Tab state management
- Responsive design
- Active tab indicators

### Stats Cards (`src/components/custom/StatsCards.tsx`)
- Attendance percentage with color coding
- CGPA display
- Marks summary
- OD hours tracker

### Command Palette (`src/components/custom/CommandPalette.tsx`)
- Fuzzy search (`⌘K` shortcut)
- Keyboard navigation
- Action execution
- Context-aware suggestions

### Theme System (`src/components/theme/ThemeProvider.tsx`)
- Three themes: Light, Dark, Midnight
- Custom accent colors
- Persists to localStorage
- CSS variables for dynamic theming

## State Management

### React Context
- **AuthContext**: User session, login/logout, token management
- **ThemeContext**: Current theme, accent color, toggle functions
- **DataContext**: Cached API data, refetch functions

### Local State
- Component-level useState for UI state
- useReducer for complex form state
- SWR/React Query for server state (if used)

## Styling Approach

### Tailwind CSS v4
- CSS-first configuration via `@import "tailwindcss"`
- Custom theme values in `globals.css`
- Dark mode via `class` strategy
- JIT compilation for minimal bundle

### CSS Variables
```css
:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --primary: #1a1a2e;
  --accent: #00d4aa;
  /* ... */
}

.dark {
  --background: #0a0a0a;
  --foreground: #fafafa;
  /* ... */
}

.midnight {
  --background: #020617;
  --foreground: #e2e8f0;
  /* ... */
}
```

## Performance Optimizations

1. **Code Splitting**: Automatic via App Router
2. **Lazy Loading**: Dynamic imports for heavy components
3. **Image Optimization**: Next.js Image component
4. **Font Optimization**: `next/font` for Google Fonts
5. **Bundle Analysis**: `@next/bundle-analyzer`
6. **Service Worker**: Caching static assets

## Accessibility

- Radix UI primitives ensure ARIA compliance
- Semantic HTML structure
- Focus management
- Keyboard navigation
- Color contrast ratios
- Screen reader support

## PWA Features

- **Service Worker** (`public/sw.js`): Offline caching, background sync
- **Manifest** (`public/manifest.json`): Install prompts, shortcuts
- **Push Notifications**: Web Push API with VAPID keys
- **Offline Fallback**: `~offline/page.tsx`

## Related Documentation

- [Backend Architecture](../backend.md)
- [API Client Library](../../lib/api-client.ts)
- [Theme System](../theme/ThemeProvider.tsx)
- [Component Library](../components/)