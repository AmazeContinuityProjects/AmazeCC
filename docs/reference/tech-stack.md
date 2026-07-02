# Tech Stack Reference

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | Next.js | 16.x | Full-stack React framework |
| **Language** | TypeScript | 5.9.x | Type-safe JavaScript |
| **Styling** | Tailwind CSS | v4.x | Utility-first CSS |
| **UI Primitives** | Radix UI | Latest | Accessible component primitives |
| **Animations** | Framer Motion | Latest | Animation library |
| **Charts** | Recharts | Latest | Charting library |
| **Database** | PostgreSQL | 16 | Primary database (Supabase) |
| **ORM/Client** | Supabase Client | Latest | Database access |
| **Auth** | Custom HMAC | - | Token-based authentication |
| **Scraping** | Cheerio + Axios | Latest | VTOP HTML parsing |
| **Cookies** | tough-cookie | Latest | Cookie jar management |
| **Validation** | Zod | Latest | Schema validation |
| **Testing** | Vitest | Latest | Unit/integration testing |
| **Linting** | ESLint | Latest | Code quality |
| **Formatting** | Prettier | Latest | Code formatting |

## Frontend Dependencies

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.9.0",
    "tailwindcss": "^4.0.0",
    "@radix-ui/react-*": "latest",
    "framer-motion": "^11.0.0",
    "recharts": "^2.12.0",
    "zod": "^3.22.0",
    "swr": "^2.2.0",
    "date-fns": "^3.6.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.400.0",
    "sonner": "^1.4.0",
    "vaul": "^0.9.0",
    "embla-carousel-react": "^8.0.0",
    "cmdk": "^1.0.0",
    "next-themes": "^0.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/node": "^20.12.0",
    "vitest": "^1.5.0",
    "@testing-library/react": "^14.2.0",
    "@testing-library/jest-dom": "^6.4.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0",
    "eslint-config-next": "^14.2.0",
    "@tailwindcss/typography": "^0.5.0"
  }
}
```

## Backend Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.40.0",
    "cheerio": "^1.0.0",
    "axios": "^1.6.0",
    "tough-cookie": "^4.1.0",
    "jsonwebtoken": "^9.0.0",
    "crypto-js": "^4.2.0",
    "winston": "^3.12.0",
    "node-cron": "^3.0.3",
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "nodemailer": "^6.9.0",
    "web-push": "^3.6.0",
    "@aws-sdk/client-s3": "^3.500.0",
    "@aws-sdk/s3-request-presigner": "^3.500.0"
  },
  "devDependencies": {
    "@types/cheerio": "^0.22.0",
    "@types/tough-cookie": "^4.0.5",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/crypto-js": "^4.2.1",
    "@types/node-cron": "^3.0.11",
    "@types/nodemailer": "^6.4.14",
    "@types/web-push": "^3.6.3"
  }
}
```

## Key Libraries Explained

### Next.js 16 (App Router)
- **App Router**: File-based routing with layouts
- **Server Components**: Default, no client bundle
- **Streaming**: Suspense boundaries for progressive rendering
- **Actions**: Server-side mutations
- **Middleware**: Request/response interception

### Tailwind CSS v4
- **CSS-first**: Configuration via `@import "tailwindcss"`
- **No config file**: Theme via CSS variables
- **JIT**: Just-in-time compilation
- **Dark mode**: Class-based strategy

### Radix UI
Unstyled, accessible primitives:
- `Dialog`, `DropdownMenu`, `Tabs`, `Tooltip`
- `Select`, `Checkbox`, `RadioGroup`, `Switch`
- `Toast`, `Tooltip`, `Popover`, `HoverCard`

### Framer Motion
- **AnimatePresence**: Exit animations
- **Layout animations**: Shared layout transitions
- **Gesture recognition**: Drag, hover, tap
- **Reduced motion**: Respects prefers-reduced-motion

### Supabase
- **PostgreSQL**: Full SQL database
- **Auth**: Built-in (not used - custom auth)
- **Realtime**: WebSocket subscriptions
- **Storage**: File storage (B2 used instead)
- **Edge Functions**: Serverless functions

### Cheerio
- **jQuery-like API**: For server-side HTML parsing
- **Fast**: No browser needed
- **Selectors**: CSS selector support

## Version Management

### Node.js
```bash
# Required: 18.17.0+
# Recommended: 20.x LTS
node --version
```

### Package Manager
```bash
# npm (comes with Node.js)
npm --version

# Or pnpm (faster, disk efficient)
corepack enable pnpm
```

## Update Strategy

### Dependencies
```bash
# Check outdated
npm outdated

# Update patch/minor
npm update

# Update major (careful)
npm install package@latest
```

### Next.js
```bash
# Check for updates
npx @next/codemod@latest upgrade
```

### Security
```bash
# Audit
npm audit

# Fix
npm audit fix
```

## Related Documentation

- [Project Structure](./project-structure.md)
- [Scripts Reference](./scripts.md)
- [Environment Variables](./environment-variables.md)
- [Architecture Overview](../architecture/overview.md)