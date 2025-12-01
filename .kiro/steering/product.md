---
inclusion: always
---

# Bookmark Manager

A cross-platform bookmark manager for organizing, searching, and managing web bookmarks with collections, tags, and annotations.

## Domain Model

### Core Entities
- **User**: Account with email auth, FREE/PRO plan tiers
- **Collection**: Hierarchical folders (supports nesting via parentId), can be public/shared
- **Bookmark**: URL with metadata (title, excerpt, domain, type), belongs to one collection
- **Tag**: User-scoped labels with normalized names, many-to-many with bookmarks
- **Highlight**: Text selections with annotations on bookmarked pages
- **Reminder**: Scheduled notifications for bookmarks

### Bookmark Types
`LINK | ARTICLE | VIDEO | IMAGE | DOCUMENT | AUDIO`

### Permission Roles
`VIEWER | EDITOR` - for shared collection access

## Business Rules

- URLs are normalized for duplicate detection (`normalizedUrl` field)
- Tags are normalized per-user (unique constraint on `ownerId + normalizedName`)
- Collections support hierarchical nesting (parent-child relationships)
- Bookmarks must belong to exactly one collection
- Sharing uses unique `shareSlug` for public collections
- Content snapshots stored in S3/MinIO (`contentSnapshotPath`)

## User Plans
- **FREE**: Basic bookmark management
- **PRO**: Extended features and storage limits