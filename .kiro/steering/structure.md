# Project Structure

```
bookmark-manager/
├── packages/
│   ├── backend/           # Fastify API server
│   │   ├── prisma/        # Database schema and migrations
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── config/    # Environment and logger setup
│   │       ├── db/        # Prisma client singleton
│   │       ├── models/    # Zod schemas and TypeScript types
│   │       ├── utils/     # Shared utilities
│   │       ├── app.ts     # Fastify app configuration
│   │       └── index.ts   # Entry point
│   ├── frontend/          # Web application (Vite)
│   │   └── src/
│   └── extension/         # Browser extension
│       └── src/
├── infra/
│   └── docker/            # Docker initialization scripts
├── docker-compose.yml     # Local development services
├── tsconfig.base.json     # Shared TypeScript config
└── pnpm-workspace.yaml    # Workspace definition
```

## Conventions

### File Naming
- Models: `{name}.model.ts` with companion `{name}.model.property.ts` for property tests
- Utilities: `{name}.ts` with companion `{name}.property.ts` for property tests
- Use kebab-case for file names

### Code Patterns
- Models define Zod schemas first, then derive TypeScript types with `z.infer<>`
- Export validation functions: `validate{Entity}()`, `validateCreate{Entity}()`, `validateUpdate{Entity}()`
- Export serialization functions: `serialize{Entity}()`, `deserialize{Entity}()`
- Use `.js` extension in imports (ES Modules requirement)

### Database
- Prisma schema uses `@map()` for snake_case column names
- Models use camelCase in TypeScript
- Always define indexes for foreign keys and frequently queried fields

### Testing
- Property-based tests use fast-check
- Test files: `*.test.ts` or `*.property.ts`
- Run single execution with `vitest run` (not watch mode)
