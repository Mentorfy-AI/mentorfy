# PRD: Mentorfy MVP Backend

> Goal: Ship a production-ready backend for the Rafael Tatts experience that enables real AI-powered conversations, persistent user context, and full event observability.

## Overview

The frontend shell exists. We need the backend to make it real:

1. **User context persistence** - Everything a user shares gets stored and retrieved for LLM calls
2. **Real AI agents** - Replace hardcoded mocks with actual Claude-powered responses
3. **Event tracking** - Full visibility into the funnel (drop-offs, conversions, LLM quality)
4. **Auth flow** - Anonymous → Clerk authenticated, with session linking

## Non-Goals (for MVP)

- Multi-tenant admin UI (Rafael is hardcoded as the only org)
- Content/knowledge graph integration (hardcode for now, tool comes later)
- Advanced abuse detection (basic rate limiting only - see SECURITY_RATE_LIMITING_PLAN.md)
- Mobile apps

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│                      (Brady's domain - hands off)                │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer (Next.js)                      │
│    /api/session    /api/chat    /api/generate/[type]            │
└─────────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    ┌─────────┐   ┌───────────┐  ┌─────────┐
    │Supabase │   │Supermemory│  │Anthropic│
    │(sessions)│  │ (context) │  │  (LLM)  │
    └─────────┘   └───────────┘  └─────────┘
                        │              │
                        │              ▼
                        │        ┌──────────┐
                        │        │ Langfuse │
                        │        │ (traces) │
                        │        └──────────┘
                        │
    ┌───────────────────┴───────────────────┐
    │              PostHog                   │
    │    (events - called from frontend)     │
    └────────────────────────────────────────┘
```

---

## Data Model

### Supabase: `sessions`

One table. A session represents a user's journey through an experience.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT,                          -- null until authenticated
  clerk_org_id TEXT NOT NULL,                  -- 'rafael-tatts' for now
  email TEXT,
  phone TEXT,
  name TEXT,
  supermemory_container TEXT UNIQUE NOT NULL,  -- e.g., 'rafael-tatts-{uuid}'
  status TEXT DEFAULT 'in_progress',           -- in_progress, completed, abandoned
  context JSONB DEFAULT '{}',                  -- buffered answers before Supermemory push
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_email_org ON sessions(email, clerk_org_id);
CREATE INDEX idx_sessions_clerk ON sessions(clerk_user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
```

**Key design decisions**:

- **Contact info as columns** - Email, phone, name are first-class. These are leads; contact info matters for direct response.
- **`context` JSONB as source of truth for generation** - Stores structured answers. Used by `/api/generate` endpoints. Also useful for querying, debugging.
- **`status` for lifecycle** - Track where sessions are in their journey.
- **Two context sources by purpose**:
  - `/api/generate` reads from JSONB (always fresh, no latency)
  - `/api/chat` searches Supermemory (semantic, eventually consistent)

### Supermemory: Semantic Memory (Chat Only)

Written to async on every session update. Powers `/api/chat` context retrieval.

**Container naming**: `{org_id}-{session_uuid}` (e.g., `rafael-tatts-550e8400-e29b-41d4-a716-446655440000`)

**Memory content**: Natural language descriptions of what the user shared, plus conversation history.

```typescript
// Example memories
{ content: "User is a tattoo artist charging $200-400 per day" }
{ content: "User's main blocker is fear of raising prices" }
{ content: "User asked: How do I raise my prices without losing clients?" }
```

**Eventual consistency**: Supermemory ingestion takes seconds. If a user chats immediately after answering a question, context may be slightly incomplete. This is acceptable for MVP.

**Not used for `/api/generate`** - Generation endpoints read from JSONB directly (see below).

### PostHog: Analytics

Events fired directly from frontend using PostHog JS SDK. No backend proxy needed.

### Langfuse: LLM Observability

All LLM calls traced with inputs, outputs, latency, costs. Backend handles this internally.

---

## API Endpoints

### `POST /api/session`

Create a new session when someone starts the experience.

**Request**:
```typescript
{
  orgId: string  // "rafael-tatts"
}
```

**Response**:
```typescript
{
  sessionId: string  // UUID
}
```

**Behavior**:
- Creates row in `sessions` with generated `supermemory_container`
- If `email` provided and matches existing session for same org, return that session instead (handles returning users)

---

### `PATCH /api/session/[id]`

Update session with contact info, answers, or other data.

**Request**:
```typescript
{
  email?: string
  phone?: string
  name?: string
  status?: 'in_progress' | 'completed' | 'abandoned'
  context?: Record<string, any>  // Merged into existing context
}
```

**Response**:
```typescript
{
  success: true,
  sessionId: string  // May differ if merged with existing session by email
}
```

**Behavior**:
- Updates contact info columns if provided
- Updates `status` if provided
- Deep merges `context` into existing `context` JSONB
- Transforms context updates into semantic memories and writes to Supermemory (async)
- If `email` is provided and matches another session for same org with a `clerk_user_id`, return that session's ID (user already has an account)

---

### `POST /api/session/[id]/link`

Link session to Clerk user after authentication.

**Request**:
```typescript
{
  clerkUserId: string
}
```

**Response**:
```typescript
{
  success: true,
  sessionId: string
}
```

**Behavior**:
- Sets `clerk_user_id` on the session
- Simple update, no complex merge logic

---

### `POST /api/chat`

Stream a chat response from an agent.

**Request**:
```typescript
{
  sessionId: string,
  agentId: string,       // e.g., "rafael-chat"
  message: string
}
```

**Response**: Server-Sent Events stream (Vercel AI SDK format)

**Behavior**:
1. Fetch session from DB
2. Search Supermemory for relevant context
3. Load agent config from registry
4. Call LLM with context + message + tools
5. Stream response
6. Log trace to Langfuse
7. Save conversation turn to Supermemory (async)

---

### `POST /api/generate/[type]`

Non-chat LLM generation (diagnosis, summary, etc.).

**Request**:
```typescript
{
  sessionId: string
}
```

No context in request body. Backend owns the context.

**Response**:
```typescript
{
  content: string
}
```

**Types** (TBD based on frontend needs):
- `diagnosis` - Generate phase-end diagnosis
- `summary` - Summarize user's journey
- Others added as needed

**Behavior**:
1. Fetch session from DB
2. Read `context` JSONB (source of truth - always fresh)
3. Load agent config for this generation type
4. Call LLM with context
5. Log trace to Langfuse
6. Return generated content

**Why JSONB, not Supermemory?** Generation happens immediately after user completes a phase. Supermemory may still be ingesting. JSONB is always current.

---

## Agent Architecture

### File Structure

```
src/
├── agents/
│   ├── registry.ts           # getAgent(id) → AgentConfig
│   ├── types.ts              # AgentConfig, ToolConfig types
│   │
│   ├── rafael/
│   │   ├── chat.ts           # Rafael chat agent
│   │   ├── diagnosis.ts      # Diagnosis generator
│   │   ├── summary.ts        # Journey summarizer
│   │   └── tools/
│   │       ├── index.ts      # Export all Rafael tools
│   │       └── placeholder.ts # Placeholder until knowledge graph ready
│   │
│   └── _shared/
│       └── tools/
│           └── .gitkeep          # Tools added as needed
│
├── lib/
│   ├── supermemory.ts        # Supermemory client wrapper
│   ├── langfuse.ts           # Langfuse client + trace helper
│   └── db.ts                 # Supabase client
│
└── app/
    └── api/
        ├── session/
        │   ├── route.ts              # POST /api/session
        │   └── [id]/
        │       ├── route.ts          # PATCH /api/session/[id]
        │       └── link/
        │           └── route.ts      # POST /api/session/[id]/link
        ├── chat/
        │   └── route.ts              # POST /api/chat
        └── generate/
            └── [type]/
                └── route.ts          # POST /api/generate/[type]
```

### Agent Config Type

```typescript
// src/agents/types.ts

export interface ToolConfig {
  name: string
  description: string
  parameters: Record<string, any>  // JSON Schema
  execute: (params: any, context: ToolContext) => Promise<any>
}

export interface AgentConfig {
  id: string
  model: string                                    // e.g., "claude-sonnet-4-20250514"
  temperature: number
  maxTokens: number
  systemPrompt: string | ((memories: string) => string)
  tools?: ToolConfig[]
}

export interface ToolContext {
  sessionId: string
  orgId: string
  context: Record<string, any>  // The session's context JSONB
}
```

### Example Agent

```typescript
// src/agents/rafael/chat.ts

import { AgentConfig } from '../types'

export const rafaelChat: AgentConfig = {
  id: 'rafael-chat',
  model: 'claude-sonnet-4-20250514',
  temperature: 0.7,
  maxTokens: 1024,

  systemPrompt: (context: string) => `You are Rafael, a world-class tattoo artist who built a multiple six-figure business. You now mentor other tattoo artists on scaling their businesses.

Your communication style:
- Direct and no-BS, but warm
- Use concrete examples from tattooing
- Challenge limiting beliefs about pricing and sales
- Guide toward booking a strategy call when appropriate

Here's what you know about this person:
${context}

Your goal is to understand their situation deeply and help them see what's possible. When they're ready, guide them toward booking a call.`,

  tools: [],  // Tools added as needed (knowledge graph, etc.)
}
```

### Agent Registry

```typescript
// src/agents/registry.ts

import { AgentConfig } from './types'
import { rafaelChat } from './rafael/chat'
import { rafaelDiagnosis } from './rafael/diagnosis'
import { rafaelSummary } from './rafael/summary'

const agents: Record<string, AgentConfig> = {
  'rafael-chat': rafaelChat,
  'rafael-diagnosis': rafaelDiagnosis,
  'rafael-summary': rafaelSummary,
}

export function getAgent(id: string): AgentConfig {
  const agent = agents[id]
  if (!agent) {
    throw new Error(`Agent not found: ${id}`)
  }
  return agent
}

export function listAgents(): string[] {
  return Object.keys(agents)
}
```

---

## Event Tracking

Events are fired directly from the frontend using the PostHog JS SDK. No backend proxy.

### Event Naming Convention

```
{domain}.{action}

Domains: session, phase, step, chat, content, conversion
Actions: created, started, completed, viewed, sent, received, served, booked
```

### Core Events (Frontend-Fired)

| Event | Properties | Trigger |
|-------|------------|---------|
| `session.created` | `orgId`, `sessionId` | Experience started |
| `session.authenticated` | `sessionId` | Clerk auth completed |
| `phase.started` | `sessionId`, `phaseSlug` | User enters a phase |
| `phase.completed` | `sessionId`, `phaseSlug`, `duration` | User finishes a phase |
| `step.viewed` | `sessionId`, `phaseSlug`, `stepSlug`, `stepType` | User sees a step |
| `step.completed` | `sessionId`, `phaseSlug`, `stepSlug`, `stepType` | User completes a step |
| `chat.message_sent` | `sessionId`, `messageLength` | User sends chat |
| `chat.message_received` | `sessionId`, `responseLength`, `latency` | AI responds |
| `content.served` | `sessionId`, `contentType`, `contentId` | Video/resource shown |
| `conversion.checkout_started` | `sessionId`, `planId` | Whop checkout opened |
| `conversion.checkout_completed` | `sessionId`, `planId`, `amount` | Purchase completed |
| `conversion.call_booked` | `sessionId`, `calendlyUrl` | Call scheduled |

### Drop-off Tracking

PostHog funnels track the journey:
- Landing → Session created
- Session created → Phase 1 started
- Phase 1 step-by-step progression
- Phase 1 complete → Phase 2 start
- Any step → Conversion event

### LLM Observability (Backend)

Langfuse captures all LLM calls with:
- Input/output content
- Token usage and costs
- Latency
- Model and parameters
- Session ID for correlation

---

## External Services Setup

### Supabase

- **Project**: Existing project
- **New table**: `sessions`
- **RLS**: Service role key for API routes (no public access)

### Supermemory

- **Account**: Existing
- **API Key**: Needs env var `SUPERMEMORY_API_KEY`

### Clerk

- **Instance**: Existing production instance
- **Org**: "Rafael Tatts" already exists
- **Env vars**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`

### Langfuse

- **Account**: New signup required
- **Env vars**: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`

### PostHog

- **Account**: Existing or new
- **Env vars**: `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_HOST`

### Anthropic

- **Account**: Existing
- **Env var**: `ANTHROPIC_API_KEY`

---

## Environment Variables

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Supermemory
SUPERMEMORY_API_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Langfuse
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=
POSTHOG_HOST=https://app.posthog.com

# Anthropic
ANTHROPIC_API_KEY=

# Upstash (for rate limiting - post-MVP)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Implementation Order

### Phase 1: Foundation
1. Set up new Vercel project
2. Create Supabase `sessions` table
3. Implement `/api/session` endpoints (create, update, link, complete)
4. Implement Supermemory client wrapper (write on update, search for context)

### Phase 2: Agents
1. Agent types and registry structure
2. Implement `rafael-chat` agent config
3. Implement `/api/chat` with streaming (Vercel AI SDK)
4. Implement `rafael-diagnosis` and `rafael-summary` agent configs
5. Implement `/api/generate/[type]`
6. Wire up Langfuse tracing

### Phase 3: Polish
1. Test full flow end-to-end
2. Add basic rate limiting (Upstash) - see SECURITY_RATE_LIMITING_PLAN.md
3. Verify Langfuse traces are capturing correctly

### Phase 4: Frontend Integration
1. Brady wires up endpoints
2. Brady adds PostHog events
3. Remove mock responses
4. Test with real users

---

## Success Criteria

- [ ] Anonymous user can complete full Rafael experience with real AI responses
- [ ] Session context persists (close browser, come back, AI remembers via session lookup)
- [ ] Clerk auth links session to account
- [ ] All LLM calls traced in Langfuse
- [ ] Response latency < 3s for first token
- [ ] No hardcoded mock responses remain in production flow

---

## Open Items

- [ ] Langfuse account signup
- [ ] Vercel project creation
- [ ] Knowledge graph tool integration (post-MVP)
- [ ] Whop webhook for checkout completion events (post-MVP)
- [ ] Calendly webhook for booking events (post-MVP)
