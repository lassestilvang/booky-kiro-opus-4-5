-- PostgreSQL initialization script for bookmark-manager
-- This script runs on first container startup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE bookmark_manager TO bookmark;

-- Create schema for application
CREATE SCHEMA IF NOT EXISTS app;
GRANT ALL ON SCHEMA app TO bookmark;
