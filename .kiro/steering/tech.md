# Tech Stack

## Build System
- Package Manager: pnpm (v9.0.0) with workspaces
- Node.js: >=20.0.0
- TypeScript: 5.3+ with strict mode
- Module System: ES Modules (`"type": "module"`)

## Backend
- Framework: Fastify 4.x
- Database: PostgreSQL 16 with Prisma ORM
- Caching: Redis 7
- Search: Elasticsearch 8.x
- Object Storage: MinIO (S3-compatible)
- Validation: Zod
- Logging: Pino
- API Docs: OpenAPI/Swagger

## Frontend
- Build Tool: Vite 5.x
- Testing: Vitest

## Browser Extension
- Build Tool: Vite 5.x

## Code Quality
- Linting: ESLint with TypeScript plugin
- Formatting: Prettier
- Testing: Vitest with fast-check for property-based tests

## Common Commands

```bash
# Install dependencies
pnpm install

# Development (all packages)
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test:run

# Lint and format
pnpm lint
pnpm format

# Backend-specific
cd packages/backend
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations
pnpm db:push        # Push schema changes
pnpm db:seed        # Seed database

# Start infrastructure
docker-compose up -d
```

## Environment
- Copy `.env.example` to `packages/backend/.env`
- Required services: PostgreSQL, Redis, Elasticsearch, MinIO
