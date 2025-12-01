---
inclusion: always
---

# Tech Stack

## Runtime & Build
- Node.js: >=20.0.0
- Package Manager: pnpm v9+ with workspaces
- TypeScript: 5.3+ strict mode
- Module System: ES Modules — use `.js` extension in imports

## Backend Stack
- Fastify 4.x (framework)
- PostgreSQL 16 + Prisma ORM (database)
- Redis 7 (caching)
- Elasticsearch 8.x (search)
- MinIO (S3-compatible storage)
- Zod (validation)
- Pino (logging)

## Frontend & Extension
- Vite 5.x for builds
- Vitest for testing

## Code Quality
- ESLint + TypeScript plugin
- Prettier for formatting
- Vitest + fast-check for property-based tests

## Key Commands
```bash
pnpm install          # Install all dependencies
pnpm dev              # Start development
pnpm build            # Build all packages
pnpm test:run         # Run tests (not watch mode)
pnpm lint && pnpm format

# Backend database
cd packages/backend
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes
pnpm db:seed          # Seed database

docker-compose up -d  # Start infrastructure
```

## Critical Rules
- Always use `.js` extension in TypeScript imports (ES Modules)
- Run `pnpm db:generate` after Prisma schema changes
- Use `vitest run` for tests, never watch mode in automation
- Environment: copy `.env.example` to `packages/backend/.env`
