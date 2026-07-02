# Getting Started Guide

## Prerequisites

- **Node.js**: 18.17.0 or later
- **npm**: 9.0.0 or later (comes with Node.js)
- **Git**: For version control
- **VS Code** (recommended): With TypeScript, ESLint, Prettier extensions

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/AmazeContinuityProjects/AmazeCC.git
cd AmazeCC
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

**Required Environment Variables:**
```env
# Frontend
NEXT_PUBLIC_API_URL=https://api.amazecc.com

# Backend (if self-hosting)
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-256-bit-secret
ADMIN_TOKEN=your-admin-token

# External Services (if self-hosting)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### 4. Run Development Server
```bash
npm run dev
```

Open http://localhost:3001 in your browser.

## Project Structure Overview

```
AmazeCC/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/              # Utility functions
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript definitions
│   ├── data/             # Static JSON data
│   └── __tests__/        # Test files
├── public/               # Static assets
├── docs/                 # Documentation (this folder)
├── .github/              # GitHub workflows
└── Configuration files
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HTTPS (port 3001) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run Vitest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run typecheck` | Run TypeScript compiler check |
| `npm run api-dev` | Start API in dev mode |
| `npm run api-build` | Build API |
| `npm run api-start` | Start API production |

## Development Workflow

### 1. Create Feature Branch
```bash
git checkout -b feat/your-feature-name
```

### 2. Make Changes
- Follow TypeScript strict mode
- Add tests for new functionality
- Update documentation if needed

### 3. Run Checks
```bash
npm run lint
npm run typecheck
npm run test
```

### 4. Commit Changes
```bash
git add .
git commit -m "feat: add your feature description"
```

### 5. Push and Create PR
```bash
git push origin feat/your-feature-name
# Create PR on GitHub
```

## VS Code Setup

### Recommended Extensions
- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)
- **TypeScript Hero** (rbbit.typescript-hero)
- **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss)
- **GitLens** (eamodio.gitlens)

### Settings (`.vscode/settings.json`)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  }
}
```

## HTTPS in Development

The dev server runs on HTTPS by default using self-signed certificates.

**To trust the certificate:**
1. Open https://localhost:3001
2. Browser will show "Not Secure" warning
3. Click "Advanced" → "Proceed to localhost (unsafe)"
4. Or add certificate to system trust store

## Common Issues

### Port 3001 Already in Use
```bash
# Find and kill process
lsof -ti:3001 | xargs kill -9
```

### Module Resolution Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors After Pull
```bash
npm run typecheck
# Fix any new type errors
```

## Next Steps

- Read [Architecture Overview](../architecture/overview.md)
- Explore [API Documentation](../api/overview.md)
- Check [Contributing Guide](../contributing/pull-request-guide.md)
- Review [Code Style Guide](../contributing/style-guide.md)

## Need Help?

- Check [FAQ](faq.md) (if exists)
- Search [GitHub Issues](https://github.com/AmazeContinuityProjects/AmazeCC/issues)
- Ask in [Discussions](https://github.com/AmazeContinuityProjects/AmazeCC/discussions)