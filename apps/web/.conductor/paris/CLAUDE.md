# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mentorfy is an AI-powered mentoring platform frontend built with Next.js 14, featuring document upload, processing, and interactive chat capabilities. It integrates with Supabase for authentication and a FastAPI backend for document processing.

## Development Commands

```bash
# Development server with Turbo
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Type checking (if available)
npx tsc --noEmit
```

## Architecture

### Frontend Structure
- **App Router**: Uses Next.js 14 app directory structure
- **UI Components**: Built with Radix UI primitives and custom components in `/components/ui/`
- **Authentication**: Supabase Auth with custom AuthProvider wrapper
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React hooks and context providers

### Key Directories
- `/app/` - Next.js app router pages and API routes
  - `/admin/` - Admin dashboard functionality
  - `/api/` - API route handlers (now supports bot-specific operations)
  - `/chat/[botId]/` - Bot-specific chat interface pages
  - `/behavior/[botId]/` - Bot-specific behavior settings pages
- `/components/` - React components including UI primitives
- `/lib/` - Utility functions and service clients
- `/hooks/` - Custom React hooks

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Authentication**: Supabase Auth
- **UI**: Radix UI + shadcn/ui components
- **Styling**: Tailwind CSS v4
- **Forms**: React Hook Form with Zod validation
- **Backend Integration**: FastAPI via HTTP client
- **Knowledge Graph**: Graphiti integration
- **External APIs**: OpenAI, Google Drive

## Environment Configuration

Required environment variables (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side Supabase key
- `BACKEND_API_URL` - Backend API URL (default: http://localhost:8000)
- `OPENAI_API_KEY` - For Graphiti knowledge graph
- `GOOGLE_DRIVE_CLIENT_ID/SECRET` - Google Drive integration

## Special Configurations

### Next.js Config
- ESLint and TypeScript errors ignored during builds (configured in `next.config.mjs`)
- Images are unoptimized for deployment flexibility
- Path aliases configured with `@/*` pointing to project root

### TypeScript
- Strict mode enabled
- Incremental compilation configured
- ES6 target with modern module resolution

### Supabase Integration
- Client and server-side configurations in `/lib/supabase*.ts`
- Authentication provider wraps the entire app
- Row Level Security (RLS) enabled on all tables

#### **CRITICAL: Which Supabase Client to Use**

This project uses **Clerk for authentication** with Supabase for data storage. You MUST use the correct client:

**✅ USE THIS 99% OF THE TIME:**
```typescript
import { createClerkSupabaseClient } from '@/lib/supabase-clerk-server';
```
- **When**: API routes, Server Components, any authenticated operation
- **Why**: Passes Clerk JWT to Supabase, respects RLS, filters by organization
- **Example**: User requests, bot operations, document queries

**⚠️ USE ONLY FOR SYSTEM OPERATIONS:**
```typescript
import { createServiceClient } from '@/lib/supabase-server';
```
- **When**: Webhooks, admin operations, background jobs
- **Why**: Bypasses ALL RLS - full database access
- **Warning**: Can leak data across organizations if misused!
- **Example**: Clerk webhook handlers, database migrations

**❌ DEPRECATED - DO NOT USE:**
```typescript
import { createClient } from '@/lib/supabase-server';
```
- **Status**: Legacy client without Clerk integration
- **Problem**: No JWT claims, RLS will reject most queries
- **Migration**: Replace with `createClerkSupabaseClient()`

**See `/lib/supabase-clerk-server.ts` and `/lib/supabase-server.ts` for detailed inline documentation.**

## Key Features

1. **Multi-Bot Support**: Multiple AI mentor bots per organization with independent configurations
2. **Document Management**: Upload, view, and manage documents with Google Drive integration  
3. **Bot-Specific Document Association**: Documents can be assigned to specific bots during upload
4. **Content Processing**: Documents are processed by FastAPI backend with Redis queuing
5. **Interactive Chat**: AI-powered chat interface with bot selection and bot-specific context
6. **Per-Bot Behavior Settings**: Independent behavior configuration for each mentor bot
7. **Knowledge Graph**: Graphiti integration for relationship mapping
8. **Admin Dashboard**: Content management and user administration
9. **Authentication**: Secure login/logout with Supabase Auth

## Development Notes

- The backend expects specific API endpoints for document processing and chat
- Redis is used for background job queuing in the backend
- Neo4j stores the knowledge graph data
- Google Drive integration allows bulk document imports
- File uploads support multiple formats (PDF, DOC, TXT, etc.)

### **CRITICAL: Next.js API Route Caching**

**Next.js aggressively caches GET routes** - even in dev mode, module caching can cause stale responses that are extremely hard to debug. This will make you think requests aren't reaching your backend when they actually ARE cached.

**When creating ANY new GET route in `/app/api/`**, ALWAYS add these two lines at the top:

```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

**Why this matters:**
- Without these, you may see cached responses even after backend changes
- The Next.js dev server WON'T show any indication of caching
- FastAPI won't log requests because cached responses never hit it
- This causes HOURS of debugging frustration

**When to use:**
- ✅ Any route that proxies to FastAPI
- ✅ Any route fetching dynamic data (conversations, documents, metrics)
- ❌ Static data that rarely changes (maybe)

**If you experience mysterious "request not reaching backend" issues:**
1. Check if the route has these exports
2. Hard refresh browser (Cmd+Shift+R)
3. Restart Next.js dev server

## Performance Optimizations

Recent performance improvements implemented across the frontend:

- **Authentication Loading**: Optimized tab switching to prevent unnecessary loading screens when user sessions exist
- **Bot Selector Caching**: Organization-based caching reduces upload modal loading time from 2+ seconds to ~200ms
- **Upload Processing**: Removed artificial 3-second timeouts for more responsive user feedback

## Database Schema

The Supabase database follows a multi-tenant organization-based structure:

### Core Tables
- **`organization`** - Main tenant entity with JSONB settings
- **`user_organization`** - Links users to organizations with roles (member/admin)
- **`document`** - File storage with processing status and retry logic
  - Processing statuses: `pending_upload`, `uploaded`, `processing`, `available_to_ai`, `failed`, `retrying`
  - Sync statuses: `never_synced`, `synced`, `sync_failed`, `sync_pending`
  - Error handling with retry counts and error types
- **`document_chunk`** - Text chunks with vector embeddings for RAG
- **`mentor_bot`** - AI bot configurations with customizable behavior
  - Response length: `Concise`, `Intelligent`, `Explanatory` 
  - Creativity levels: `Strict`, `Adaptive`, `Creative`
  - Custom system prompts and instructions
  - Independent behavior settings per bot

### Chat System
- **`conversation`** - Chat sessions between users and specific mentor bots
- **`message`** - Individual messages with role-based content (user/assistant)

### Processing & Integration
- **`bot_document`** - Many-to-many relationship between bots and documents
- **`processing_job`** - Background job tracking with status and retry logic
  - Job types: `document_process`, `document_sync`, `embedding_generation`
- **`google_drive_tokens`** - OAuth tokens for Google Drive integration

### Key Design Patterns
- All tables use UUIDs as primary keys
- RLS (Row Level Security) enabled on all tables for multi-tenancy
- JSONB metadata fields for flexible extension
- Comprehensive error handling with retry mechanisms
- Vector embeddings support for semantic search

## Deployment

- Frontend deploys to Vercel with environment variables
- Backend runs on Docker containers (see `DEPLOYMENT_GUIDE.md`)
- Production configuration templates available in `.env.production.template`
- Supbase and Clerk no longer require JWT templates. This has been deprecated.