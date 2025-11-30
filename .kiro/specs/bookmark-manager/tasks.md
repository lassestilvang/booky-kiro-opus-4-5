# Implementation Plan

- [x] 1. Set up project structure and core infrastructure
  - [x] 1.1 Initialize monorepo with backend, frontend, extension, and infra directories
    - Set up pnpm workspaces for monorepo management
    - Configure TypeScript with shared tsconfig base
    - Set up ESLint and Prettier with shared configs
    - _Requirements: Project structure_

  - [x] 1.2 Set up Docker Compose for local development
    - Configure PostgreSQL container with initialization scripts
    - Configure Redis container for caching and job queues
    - Configure Elasticsearch/OpenSearch container for search
    - Configure MinIO container for S3-compatible object storage
    - _Requirements: Infrastructure setup_

  - [x] 1.3 Set up backend project with Fastify and TypeScript
    - Initialize Node.js project with Fastify framework
    - Configure OpenAPI/Swagger documentation generation
    - Set up environment configuration with dotenv
    - Configure logging with Pino
    - _Requirements: Backend foundation_

  - [x] 1.4 Set up database schema and migrations
    - Install and configure Prisma ORM
    - Create initial migration with all data models (users, collections, bookmarks, tags, highlights, files, backups, permissions)
    - Set up seed script with demo data
    - _Requirements: 2.2, 3.1, 4.1, 11.1, 13.1_

- [x] 2. Implement core data models and serialization
  - [x] 2.1 Implement Bookmark model with validation and serialization
    - Create Bookmark TypeScript interfaces and Zod schemas
    - Implement JSON serialization/deserialization functions
    - Implement bookmark validation logic
    - _Requirements: 2.1, 2.2, 2.7, 2.8_

  - [x] 2.2 Write property test for Bookmark serialization round-trip
    - **Property 1: Bookmark Serialization Round-Trip**
    - **Validates: Requirements 2.7, 2.8**

  - [x] 2.3 Implement Collection model with validation and serialization
    - Create Collection TypeScript interfaces and Zod schemas
    - Implement JSON serialization/deserialization functions
    - Implement collection validation logic
    - _Requirements: 3.1, 3.6, 3.7_

  - [x] 2.4 Write property test for Collection serialization round-trip
    - **Property 2: Collection Serialization Round-Trip**
    - **Validates: Requirements 3.6, 3.7**

  - [x] 2.5 Implement Highlight model with validation and serialization
    - Create Highlight TypeScript interfaces and Zod schemas
    - Implement JSON serialization/deserialization with position context
    - Implement highlight validation logic
    - _Requirements: 11.1, 11.2, 11.6, 11.7_

  - [x] 2.6 Write property test for Highlight serialization round-trip
    - **Property 3: Highlight Serialization Round-Trip**
    - **Validates: Requirements 11.6, 11.7**

  - [x] 2.7 Implement Tag model with normalization
    - Create Tag TypeScript interfaces and Zod schemas
    - Implement tag name normalization (lowercase, trim)
    - _Requirements: 4.1_

  - [x] 2.8 Write property test for Tag normalization consistency
    - **Property 7: Tag Normalization Consistency**
    - **Validates: Requirements 4.1**

- [x] 3. Implement URL normalization utility
  - [x] 3.1 Create URL normalizer module
    - Implement URL parsing and validation
    - Implement tracking parameter removal (utm_*, fbclid, gclid, etc.)
    - Implement URL canonicalization (lowercase host, remove default ports, sort query params)
    - Implement domain extraction
    - _Requirements: 2.6_

  - [x] 3.2 Write property test for URL normalization idempotence
    - **Property 5: URL Normalization Idempotence**
    - **Validates: Requirements 2.6**

  - [x] 3.3 Write property test for tracking parameter removal
    - **Property 6: URL Normalization Removes Tracking Parameters**
    - **Validates: Requirements 2.6**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement authentication system
  - [x] 5.1 Implement user registration and password hashing
    - Create auth service with registration logic
    - Implement password hashing with bcrypt/Argon2
    - Create user repository with CRUD operations
    - _Requirements: 1.1_

  - [x] 5.2 Implement JWT token generation and validation
    - Create JWT utility for access and refresh token generation
    - Implement token validation middleware
    - Implement refresh token rotation
    - _Requirements: 1.2, 1.4_

  - [x] 5.3 Write property test for JWT token refresh validity
    - **Property 23: JWT Token Refresh Validity**
    - **Validates: Requirements 1.4**

  - [x] 5.4 Implement OAuth2 PKCE flow for browser extension
    - Create PKCE code challenge/verifier utilities
    - Implement authorization endpoint
    - Implement token exchange endpoint with PKCE validation
    - _Requirements: 1.3_

  - [x] 5.5 Write property test for PKCE code verifier validation
    - **Property 24: PKCE Code Verifier Validation**
    - **Validates: Requirements 1.3**

  - [x] 5.6 Implement rate limiting for login attempts
    - Create rate limiter middleware using Redis
    - Implement account lockout after 5 failed attempts
    - _Requirements: 1.6_

- [x] 6. Implement bookmark CRUD operations
  - [x] 6.1 Create bookmark repository with database operations
    - Implement create, read, update, delete operations
    - Implement query with filters (collection, tags, type, domain, date)
    - Implement pagination and sorting
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 6.2 Create bookmark service with business logic
    - Implement bookmark creation with metadata extraction
    - Implement URL normalization on save
    - Implement duplicate detection
    - Implement bookmark update with timestamp management
    - _Requirements: 2.1, 2.2, 2.4, 2.6, 17.1, 17.2_

  - [x] 6.3 Write property test for bookmark creation populates required fields
    - **Property 12: Bookmark Creation Populates Required Fields**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 6.4 Write property test for duplicate detection using normalized URLs
    - **Property 11: Duplicate Detection Uses Normalized URLs**
    - **Validates: Requirements 17.1, 17.2**

  - [x] 6.5 Implement bookmark deletion with cascade
    - Delete associated highlights
    - Remove tag associations
    - Delete snapshots from storage
    - _Requirements: 2.5_

  - [x] 6.6 Write property test for bookmark deletion removes associated data
    - **Property 13: Bookmark Deletion Removes Associated Data**
    - **Validates: Requirements 2.5**

  - [x] 6.7 Create bookmark API endpoints
    - POST /v1/bookmarks - create bookmark
    - GET /v1/bookmarks - list with filters
    - GET /v1/bookmarks/:id - get single bookmark
    - PUT /v1/bookmarks/:id - update bookmark
    - DELETE /v1/bookmarks/:id - delete bookmark
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Implement collection management
  - [x] 7.1 Create collection repository with database operations
    - Implement CRUD operations for collections
    - Implement query for user's owned and shared collections
    - _Requirements: 3.1, 3.2_

  - [x] 7.2 Create collection service with business logic
    - Implement collection creation with default "Unsorted" collection
    - Implement collection deletion with bookmark preservation
    - Implement public sharing with slug generation
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 7.3 Write property test for collection deletion preserves bookmarks
    - **Property 14: Collection Deletion Preserves Bookmarks**
    - **Validates: Requirements 3.4**

  - [x] 7.4 Write property test for public collection slug uniqueness
    - **Property 15: Public Collection Slug Uniqueness**
    - **Validates: Requirements 3.5**

  - [x] 7.5 Create collection API endpoints
    - POST /v1/collections - create collection
    - GET /v1/collections - list user's collections
    - GET /v1/collections/:id - get collection details
    - PUT /v1/collections/:id - update collection
    - DELETE /v1/collections/:id - delete collection
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 8. Implement tagging and filtering
  - [x] 8.1 Create tag repository and service
    - Implement tag CRUD operations
    - Implement tag suggestions based on prefix matching
    - Implement tag merge functionality
    - _Requirements: 4.1, 4.6, 4.7_

  - [x] 8.2 Write property test for tag suggestions match prefix
    - **Property 9: Tag Suggestions Match Prefix**
    - **Validates: Requirements 4.6**

  - [x] 8.3 Write property test for tag merge preserves bookmark count
    - **Property 10: Tag Merge Preserves Bookmark Count**
    - **Validates: Requirements 4.7**

  - [x] 8.4 Implement bookmark filtering logic
    - Filter by tags (AND logic)
    - Filter by type
    - Filter by domain
    - Filter by date range
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 8.5 Write property test for filter results satisfy filter criteria
    - **Property 8: Filter Results Satisfy Filter Criteria**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [x] 8.6 Create tag API endpoints
    - GET /v1/tags - list user's tags
    - POST /v1/tags/merge - merge tags
    - GET /v1/tags/suggestions - get tag suggestions
    - _Requirements: 4.1, 4.6, 4.7_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement bulk operations
  - [x] 10.1 Create bulk operation service
    - Implement bulk add tags
    - Implement bulk remove tags
    - Implement bulk move to collection
    - Implement bulk delete
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 10.2 Write property test for bulk operations affect all selected items
    - **Property 16: Bulk Operations Affect All Selected Items**
    - **Validates: Requirements 14.1, 14.2, 14.3**

  - [x] 10.3 Implement manual sort order
    - Add sortOrder field handling
    - Implement reorder endpoint
    - _Requirements: 14.4_

  - [x] 10.4 Write property test for sort order persistence
    - **Property 17: Sort Order Persistence**
    - **Validates: Requirements 14.4**

  - [x] 10.5 Create bulk operation API endpoint
    - POST /v1/bookmarks/bulk - execute bulk operation
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 11. Implement sharing and permissions
  - [x] 11.1 Create permission repository and service
    - Implement permission CRUD operations
    - Implement role-based access checks (viewer, editor)
    - _Requirements: 13.1, 13.4_

  - [x] 11.2 Write property test for permission-based access control
    - **Property 18: Permission-Based Access Control**
    - **Validates: Requirements 13.1, 13.4**

  - [x] 11.3 Implement public collection access
    - Create public collection endpoint
    - Implement anonymous read-only access
    - _Requirements: 13.2_

  - [x] 11.4 Write property test for public collection anonymous access
    - **Property 19: Public Collection Anonymous Access**
    - **Validates: Requirements 13.2**

  - [x] 11.5 Create sharing API endpoints
    - POST /v1/collections/:id/share - share collection
    - DELETE /v1/collections/:id/share/:userId - revoke share
    - GET /v1/public/:slug - public collection access
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 12. Implement highlights and annotations
  - [ ] 12.1 Create highlight repository and service
    - Implement highlight CRUD operations
    - Implement highlight search by text and annotation
    - _Requirements: 11.1, 11.2, 11.4_

  - [ ] 12.2 Write property test for highlight search returns matches
    - **Property 22: Highlight Search Returns Matches**
    - **Validates: Requirements 11.4**

  - [ ] 12.3 Create highlight API endpoints
    - POST /v1/highlights - create highlight
    - GET /v1/highlights - list highlights (with search)
    - PUT /v1/highlights/:id - update highlight
    - DELETE /v1/highlights/:id - delete highlight
    - _Requirements: 11.1, 11.2, 11.4_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement import/export functionality
  - [ ] 14.1 Implement HTML bookmark parser (Netscape format)
    - Parse HTML bookmark file structure
    - Extract folders as collections
    - Extract bookmarks with metadata
    - _Requirements: 8.1_

  - [ ] 14.2 Write property test for HTML import preserves structure
    - **Property 25: HTML Import Preserves Structure**
    - **Validates: Requirements 8.1**

  - [ ] 14.3 Implement export formatters (HTML, CSV, JSON, TXT)
    - Create HTML exporter (Netscape format)
    - Create CSV exporter
    - Create JSON exporter
    - Create TXT exporter
    - _Requirements: 8.2, 8.5_

  - [ ] 14.4 Write property test for export/import round-trip (JSON)
    - **Property 4: Export/Import Round-Trip (JSON Format)**
    - **Validates: Requirements 8.5, 8.6**

  - [ ] 14.5 Implement filtered export
    - Export by collection
    - Export search results
    - _Requirements: 8.3_

  - [ ] 14.6 Write property test for export contains only filtered bookmarks
    - **Property 26: Export Contains Only Filtered Bookmarks**
    - **Validates: Requirements 8.3**

  - [ ] 14.7 Create import/export API endpoints
    - POST /v1/import - import bookmarks
    - GET /v1/export - export bookmarks
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 15. Implement full-text search (Pro feature)
  - [ ] 15.1 Set up Elasticsearch client and index configuration
    - Create Elasticsearch client wrapper
    - Define bookmark search index mapping
    - Define highlight search index mapping
    - _Requirements: 9.1_

  - [ ] 15.2 Implement search indexing service
    - Index bookmark metadata
    - Index full page content (Pro users)
    - Remove from index on delete
    - _Requirements: 9.1, 9.2_

  - [ ] 15.3 Implement search query service
    - Full-text search with fuzzy matching
    - Phrase search support
    - Filter by tags, type, domain, date
    - _Requirements: 9.3, 9.5, 9.6_

  - [ ] 15.4 Write property test for search results contain query terms
    - **Property 20: Search Results Contain Query Terms**
    - **Validates: Requirements 9.3**

  - [ ] 15.5 Write property test for search filter application
    - **Property 21: Search Filter Application**
    - **Validates: Requirements 9.5**

  - [ ] 15.6 Create search API endpoint
    - GET /v1/search - search bookmarks
    - _Requirements: 9.3, 9.5, 9.6_

- [ ] 16. Implement background job workers
  - [ ] 16.1 Set up BullMQ job queue infrastructure
    - Configure Redis connection for BullMQ
    - Create job queue definitions
    - Set up worker process management
    - _Requirements: Background processing_

  - [ ] 16.2 Implement snapshot worker
    - Fetch page HTML
    - Extract main content using Readability
    - Store HTML and assets to S3
    - Generate thumbnail screenshot
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 16.3 Implement indexing worker
    - Process content for search indexing
    - Extract text from PDFs
    - Index content in Elasticsearch
    - _Requirements: 9.1, 9.2, 9.4_

  - [ ] 16.4 Implement broken link scanner worker
    - Check bookmark URLs for availability
    - Mark broken links in database
    - _Requirements: 17.3, 17.4_

  - [ ] 16.5 Implement backup worker
    - Generate user data export
    - Package with snapshots (Pro)
    - Store backup to S3
    - _Requirements: 12.1, 12.2, 12.3_

- [ ] 17. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Implement React frontend foundation
  - [ ] 18.1 Set up React project with Vite and TypeScript
    - Initialize Vite React project
    - Configure TypeScript
    - Set up Tailwind CSS
    - Configure React Router
    - _Requirements: Frontend foundation_

  - [ ] 18.2 Implement API client and state management
    - Create typed API client using fetch/axios
    - Set up React Query for server state
    - Set up Zustand for client state
    - _Requirements: Frontend data layer_

  - [ ] 18.3 Implement authentication UI
    - Create login page
    - Create registration page
    - Implement auth context and protected routes
    - _Requirements: 1.1, 1.2_

- [ ] 19. Implement bookmark views and components
  - [ ] 19.1 Create BookmarkCard component
    - Display cover image, title, excerpt, tags, domain
    - Implement action buttons (open, preview, edit, delete)
    - _Requirements: 5.1_

  - [ ] 19.2 Implement Grid view
    - Card grid layout with thumbnails
    - Responsive grid sizing
    - _Requirements: 5.1_

  - [ ] 19.3 Implement Headlines view
    - Compact title list with metadata
    - _Requirements: 5.2_

  - [ ] 19.4 Implement Masonry view
    - Pinterest-style variable height layout
    - _Requirements: 5.3_

  - [ ] 19.5 Implement List view
    - Detailed rows with full metadata
    - _Requirements: 5.4_

  - [ ] 19.6 Implement view mode switcher with persistence
    - Toggle between view modes
    - Persist preference to user settings
    - _Requirements: 5.5_

- [ ] 20. Implement collection and tag management UI
  - [ ] 20.1 Create collection sidebar
    - List collections with icons
    - Create/edit/delete collection dialogs
    - Drag and drop for bookmark organization
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 20.2 Create tag management UI
    - Tag input with autocomplete
    - Tag filter chips
    - Tag merge dialog
    - _Requirements: 4.1, 4.6, 4.7_

  - [ ] 20.3 Implement filter panel
    - Filter by type, domain, date range
    - Clear filters action
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 21. Implement search and preview UI
  - [ ] 21.1 Create search interface
    - Search input with instant results
    - Full-text search toggle (Pro)
    - Search result highlighting
    - _Requirements: 9.3, 9.5, 9.6_

  - [ ] 21.2 Implement reader/preview modal
    - Embedded article reader
    - Video player embed
    - Snapshot viewer
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 22. Implement highlights UI
  - [ ] 22.1 Create highlight viewer component
    - Display highlights on snapshot
    - Color picker for highlights
    - Annotation editor with Markdown
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 22.2 Create highlights list view
    - List all highlights with search
    - Export highlights
    - _Requirements: 11.4, 11.5_

- [ ] 23. Implement import/export UI
  - [ ] 23.1 Create import dialog
    - File upload for HTML bookmarks
    - Import progress indicator
    - Duplicate handling options
    - _Requirements: 8.1, 8.4_

  - [ ] 23.2 Create export dialog
    - Format selection (HTML, CSV, JSON, TXT)
    - Collection/search filter options
    - Download trigger
    - _Requirements: 8.2, 8.3_

- [ ] 24. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Implement browser extension
  - [ ] 25.1 Set up extension project structure (Manifest V3)
    - Create manifest.json for Chrome/Firefox
    - Set up build pipeline with Vite
    - Configure content scripts and background service worker
    - _Requirements: 7.1_

  - [ ] 25.2 Implement extension authentication
    - OAuth2 PKCE flow implementation
    - Secure token storage
    - _Requirements: 7.5_

  - [ ] 25.3 Implement save page functionality
    - Toolbar popup with save dialog
    - Metadata extraction (OpenGraph, schema.org)
    - Collection and tag selection
    - _Requirements: 7.1, 7.6_

  - [ ] 25.4 Implement context menu actions
    - Save image context menu
    - Save video context menu
    - Save link context menu
    - _Requirements: 7.2_

  - [ ] 25.5 Implement highlight functionality
    - Text selection detection
    - Highlight creation with color picker
    - Annotation popup
    - _Requirements: 7.3_

  - [ ] 25.6 Implement save all tabs
    - Bulk tab saving
    - Auto-tagging with date
    - _Requirements: 7.4_

- [ ] 26. Implement remaining Pro features
  - [ ] 26.1 Implement reminder system
    - Reminder CRUD operations
    - Notification scheduling
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ] 26.2 Implement file upload
    - File upload endpoint
    - S3 storage integration
    - PDF text extraction for indexing
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ] 26.3 Implement backup management UI
    - List backups
    - Create backup on demand
    - Download backup
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 27. Implement infrastructure and deployment
  - [ ] 27.1 Create production Dockerfiles
    - Backend Dockerfile with multi-stage build
    - Frontend Dockerfile with nginx
    - Worker Dockerfile
    - _Requirements: Deployment_

  - [ ] 27.2 Create Terraform infrastructure code
    - VPC and networking
    - ECS/EKS cluster
    - RDS PostgreSQL
    - ElastiCache Redis
    - OpenSearch cluster
    - S3 buckets
    - _Requirements: Infrastructure_

  - [ ] 27.3 Set up CI/CD pipeline
    - GitHub Actions workflow
    - Run tests and linting
    - Build and push Docker images
    - Deploy to staging/production
    - _Requirements: CI/CD_

- [ ] 28. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
