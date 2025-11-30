# Requirements Document

## Introduction

This document specifies the requirements for a production-ready, cross-platform bookmark manager application. The system enables users to save, organize, search, and share web bookmarks with advanced features including full-text search, permanent page archiving, highlights/annotations, and collaborative sharing. The application consists of a backend API, web frontend, browser extensions, and background processing services.

## Glossary

- **Bookmark (Raindrop)**: A saved reference to a web resource including URL, title, excerpt, metadata, and optional content snapshot
- **Collection**: A hierarchical or flat grouping of related bookmarks owned by a user
- **Tag**: A user-defined label attached to bookmarks for categorization and filtering
- **Snapshot**: A permanent archived copy of a web page's content stored for offline access
- **Highlight**: A user-selected text excerpt from a bookmarked page with optional annotation
- **Annotation**: A user-written note attached to a highlight, supporting Markdown formatting
- **Full-text Search**: Search capability that indexes and queries the complete content of saved pages
- **WARC**: Web ARChive format for storing web page snapshots with assets
- **PKCE**: Proof Key for Code Exchange - OAuth2 extension for public clients
- **Pro Tier**: Premium subscription level with additional features (archiving, full-text search, backups)

## Requirements

### Requirement 1: User Authentication and Account Management

**User Story:** As a user, I want to create an account and securely authenticate, so that I can access my bookmarks across devices.

#### Acceptance Criteria

1. WHEN a user submits valid registration credentials THEN the System SHALL create a new user account and return authentication tokens
2. WHEN a user submits valid login credentials THEN the System SHALL issue JWT access and refresh tokens
3. WHEN a browser extension initiates authentication THEN the System SHALL support OAuth2 PKCE flow for secure token exchange
4. WHEN a JWT access token expires THEN the System SHALL allow token refresh using a valid refresh token
5. WHEN a user requests account deletion THEN the System SHALL remove all user data and provide GDPR-compliant data export
6. IF invalid credentials are submitted more than 5 times within 15 minutes THEN the System SHALL temporarily lock the account

### Requirement 2: Bookmark CRUD Operations

**User Story:** As a user, I want to create, read, update, and delete bookmarks, so that I can manage my saved web resources.

#### Acceptance Criteria

1. WHEN a user submits a URL to save THEN the System SHALL create a bookmark with extracted metadata (title, excerpt, cover image, domain, type)
2. WHEN a bookmark is created THEN the System SHALL persist the bookmark with owner reference, collection assignment, and timestamps
3. WHEN a user requests bookmark details THEN the System SHALL return the bookmark with all metadata, tags, and associated highlights
4. WHEN a user updates bookmark properties THEN the System SHALL persist changes and update the modification timestamp
5. WHEN a user deletes a bookmark THEN the System SHALL remove the bookmark and all associated data (highlights, tags, snapshots)
6. WHEN a bookmark URL is saved THEN the System SHALL normalize the URL by removing tracking parameters (UTM, etc.)
7. WHEN serializing bookmark data for API responses THEN the System SHALL encode bookmarks as JSON
8. WHEN deserializing bookmark data from API requests THEN the System SHALL parse JSON and validate against the bookmark schema

### Requirement 3: Collection Management

**User Story:** As a user, I want to organize bookmarks into collections, so that I can group related content together.

#### Acceptance Criteria

1. WHEN a user creates a collection THEN the System SHALL store the collection with title, icon, and owner reference
2. WHEN a user requests their collections THEN the System SHALL return all collections owned by or shared with the user
3. WHEN a user moves a bookmark to a different collection THEN the System SHALL update the bookmark's collection reference
4. WHEN a user deletes a collection THEN the System SHALL move contained bookmarks to an "Unsorted" default collection
5. WHEN a user sets a collection as public THEN the System SHALL generate a unique share slug for public access
6. WHEN serializing collection data for storage or API THEN the System SHALL encode collections as JSON
7. WHEN deserializing collection data THEN the System SHALL parse JSON and validate against the collection schema

### Requirement 4: Tagging and Filtering

**User Story:** As a user, I want to tag bookmarks and filter by various criteria, so that I can quickly find relevant content.

#### Acceptance Criteria

1. WHEN a user adds tags to a bookmark THEN the System SHALL create tag associations and normalize tag names (lowercase, trimmed)
2. WHEN a user filters bookmarks by tags THEN the System SHALL return only bookmarks containing all specified tags
3. WHEN a user filters by type (article, video, image, file) THEN the System SHALL return only bookmarks of the specified type
4. WHEN a user filters by domain THEN the System SHALL return only bookmarks from the specified domain
5. WHEN a user filters by date range THEN the System SHALL return only bookmarks created within the specified period
6. WHEN a user requests tag suggestions THEN the System SHALL return frequently used tags matching the input prefix
7. WHEN a user merges tags THEN the System SHALL update all bookmark associations to use the target tag and remove the source tag

### Requirement 5: Multiple View Modes

**User Story:** As a user, I want to view my bookmarks in different layouts, so that I can browse content in my preferred format.

#### Acceptance Criteria

1. WHEN a user selects Grid view THEN the System SHALL display bookmarks as cards with cover thumbnails, title, and excerpt
2. WHEN a user selects Headlines view THEN the System SHALL display bookmarks as a compact title list with metadata
3. WHEN a user selects Masonry view THEN the System SHALL display bookmarks in a Pinterest-style variable-height layout
4. WHEN a user selects List view THEN the System SHALL display bookmarks as detailed rows with full metadata
5. WHEN a user changes view mode THEN the System SHALL persist the preference and apply it on subsequent visits

### Requirement 6: Instant Preview and Reader Mode

**User Story:** As a user, I want to preview content without leaving the app, so that I can quickly review saved pages.

#### Acceptance Criteria

1. WHEN a user opens a bookmark preview THEN the System SHALL display readable content in an embedded reader view
2. WHEN previewing an article THEN the System SHALL extract and display main content stripped of navigation and ads
3. WHEN previewing a video THEN the System SHALL embed a playable video player within the app
4. WHEN a snapshot exists for the bookmark THEN the System SHALL offer the option to view the archived version

### Requirement 7: Browser Extension

**User Story:** As a user, I want a browser extension to save content quickly, so that I can bookmark pages without switching to the main app.

#### Acceptance Criteria

1. WHEN a user clicks the extension toolbar button THEN the System SHALL display a save dialog with extracted page metadata
2. WHEN a user right-clicks an image or video THEN the System SHALL offer a context menu option to save that media
3. WHEN a user selects text and activates the extension THEN the System SHALL create a highlight with the selected text
4. WHEN a user triggers "Save All Tabs" THEN the System SHALL create bookmarks for all open tabs with a date-based tag
5. WHEN the extension authenticates THEN the System SHALL use OAuth2 PKCE flow and store tokens securely
6. WHEN the extension saves a bookmark THEN the System SHALL display confirmation and allow quick tag/collection assignment

### Requirement 8: Import and Export

**User Story:** As a user, I want to import existing bookmarks and export my data, so that I can migrate between services and backup my content.

#### Acceptance Criteria

1. WHEN a user uploads a bookmarks HTML file THEN the System SHALL parse and import bookmarks preserving folder structure as collections
2. WHEN a user exports a collection THEN the System SHALL generate a downloadable file in the selected format (HTML, CSV, JSON, TXT)
3. WHEN a user exports search results THEN the System SHALL include only the filtered bookmarks in the export
4. WHEN importing bookmarks THEN the System SHALL detect and flag duplicate URLs
5. WHEN serializing export data THEN the System SHALL encode bookmarks in the requested format (HTML, CSV, JSON, TXT)
6. WHEN deserializing import data THEN the System SHALL parse the file format and validate bookmark entries

### Requirement 9: Full-Text Search (Pro Feature)

**User Story:** As a Pro user, I want to search within the content of saved pages, so that I can find bookmarks based on their full text.

#### Acceptance Criteria

1. WHEN a bookmark is saved by a Pro user THEN the System SHALL queue a background job to fetch, clean, and index page content
2. WHEN indexing page content THEN the System SHALL strip boilerplate (ads, navigation) and extract main text
3. WHEN a Pro user performs a full-text search THEN the System SHALL query the search index and return matching bookmarks
4. WHEN indexing PDF or EPUB files THEN the System SHALL extract embedded text for search indexing
5. WHEN search results are returned THEN the System SHALL support filtering by tag, type, domain, and date range
6. WHEN a search query is submitted THEN the System SHALL support fuzzy matching and phrase search

### Requirement 10: Permanent Copies and Archiving (Pro Feature)

**User Story:** As a Pro user, I want permanent copies of saved pages, so that I can access content even if the original disappears.

#### Acceptance Criteria

1. WHEN a Pro user saves a bookmark with archiving enabled THEN the System SHALL queue a snapshot job
2. WHEN creating a snapshot THEN the System SHALL save the page HTML and essential assets to object storage
3. WHEN a snapshot is created THEN the System SHALL generate a thumbnail screenshot for grid view
4. WHEN a user requests the archived version THEN the System SHALL serve the stored snapshot
5. WHEN the original page returns 4xx or 5xx errors THEN the System SHALL indicate the page is unavailable and offer the snapshot

### Requirement 11: Highlights and Annotations (Pro Feature)

**User Story:** As a Pro user, I want to highlight text and add annotations, so that I can mark important passages and add notes.

#### Acceptance Criteria

1. WHEN a user selects text in a page or snapshot THEN the System SHALL create a highlight with the selected text and DOM context
2. WHEN creating a highlight THEN the System SHALL allow color selection and optional Markdown annotation
3. WHEN a user views a bookmarked page THEN the System SHALL display existing highlights overlaid on the content
4. WHEN a user searches highlights THEN the System SHALL return highlights matching the query text or annotation
5. WHEN a user exports highlights THEN the System SHALL generate a document with all highlights and annotations
6. WHEN serializing highlight data THEN the System SHALL encode highlights as JSON with position context
7. WHEN deserializing highlight data THEN the System SHALL parse JSON and validate highlight structure

### Requirement 12: Backups (Pro Feature)

**User Story:** As a Pro user, I want automatic backups of my data, so that I can restore my bookmarks if needed.

#### Acceptance Criteria

1. WHEN a Pro user requests a backup THEN the System SHALL generate a downloadable archive of all user data
2. WHEN automatic backup is enabled THEN the System SHALL generate daily backups for Pro users
3. WHEN a backup is generated THEN the System SHALL include bookmarks, collections, tags, highlights, and snapshots
4. WHEN a user restores from backup THEN the System SHALL import all data and resolve conflicts with existing items

### Requirement 13: Sharing and Permissions

**User Story:** As a user, I want to share collections with others, so that I can collaborate or publish curated content.

#### Acceptance Criteria

1. WHEN a user shares a collection with another user THEN the System SHALL create a permission record with the specified role (viewer, editor)
2. WHEN a collection is shared as public THEN the System SHALL allow unauthenticated read-only access via the share slug
3. WHEN an editor modifies a shared collection THEN the System SHALL persist changes visible to all collaborators
4. WHEN a user revokes sharing THEN the System SHALL remove the permission record and deny further access

### Requirement 14: Batch Operations

**User Story:** As a user, I want to perform bulk actions on multiple bookmarks, so that I can efficiently manage large collections.

#### Acceptance Criteria

1. WHEN a user selects multiple bookmarks and applies tags THEN the System SHALL add the tags to all selected bookmarks
2. WHEN a user selects multiple bookmarks and moves them THEN the System SHALL update the collection reference for all selected bookmarks
3. WHEN a user selects multiple bookmarks and deletes them THEN the System SHALL remove all selected bookmarks
4. WHEN a user manually reorders bookmarks THEN the System SHALL persist the custom sort order

### Requirement 15: Reminders and Notifications

**User Story:** As a user, I want to set reminders on bookmarks, so that I can be notified to revisit saved content.

#### Acceptance Criteria

1. WHEN a user sets a reminder on a bookmark THEN the System SHALL store the reminder with the specified date and time
2. WHEN a reminder time is reached THEN the System SHALL send a notification via the user's preferred channel (push, email)
3. WHEN a user dismisses a reminder THEN the System SHALL mark the reminder as completed

### Requirement 16: File Uploads

**User Story:** As a user, I want to upload files as bookmarks, so that I can save PDFs, images, and other documents.

#### Acceptance Criteria

1. WHEN a user uploads a file THEN the System SHALL store the file in object storage and create an associated bookmark
2. WHEN uploading a PDF THEN the System SHALL extract text content for search indexing (Pro feature)
3. WHEN a user requests an uploaded file THEN the System SHALL serve the file from object storage
4. WHERE the user has a Pro plan THEN the System SHALL allow larger file uploads (up to 100MB vs 10MB for free)

### Requirement 17: Duplicate and Broken Link Detection

**User Story:** As a user, I want to identify duplicate and broken bookmarks, so that I can maintain a clean collection.

#### Acceptance Criteria

1. WHEN a bookmark is saved THEN the System SHALL check for existing bookmarks with the same normalized URL
2. WHEN a duplicate is detected THEN the System SHALL flag the bookmark and notify the user
3. WHEN the broken link scanner runs THEN the System SHALL request each bookmark URL and mark those returning errors
4. WHEN a bookmark is marked as broken THEN the System SHALL display a visual indicator in the UI

### Requirement 18: Security and Privacy

**User Story:** As a user, I want my data to be secure and private, so that I can trust the service with my information.

#### Acceptance Criteria

1. THE System SHALL enforce TLS encryption for all network communications
2. THE System SHALL implement rate limiting on all API endpoints
3. THE System SHALL use parameterized queries to prevent SQL injection
4. THE System SHALL validate and sanitize all user inputs
5. THE System SHALL store passwords using secure hashing (bcrypt or Argon2)
6. THE System SHALL not include third-party tracking or advertising scripts
