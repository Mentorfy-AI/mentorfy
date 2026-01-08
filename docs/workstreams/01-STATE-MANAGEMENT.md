# Workstream 1: State Management Refactor

**Status**: BLOCKING
**Dependencies**: None
**Blocks**: Workstream 2 (PostHog), Workstream 3 (Multi-Mentor)

---

## Objective

Replace the current over-engineered optimistic sync system with a simple server-as-truth model. Progress must survive page refresh without race conditions.

---

## Current Problem

### The Bug

Users are losing progress. Server logs show Phase 1 data when the user is actually on Phase 3/4.

### Root Cause

The system uses optimistic local state with debounced sync to the server:

```
Client updates state → 500ms debounce → PATCH to DB
                              ↓
Page refresh during debounce → GET from DB → Hydrate with stale data
                              ↓
Debounce fires → Syncs stale client data back to DB
                              ↓
Data permanently lost
```

### Why It's Over-Engineered

The current architecture solves problems we don't have:
- Multiple devices (we have one user, one tab)
- Offline support (we don't need it)
- High write frequency batching (steps take seconds, not milliseconds)

---

## Current Architecture

### Files Involved

| File | Purpose | Lines |
|------|---------|-------|
| `src/context/UserContext.tsx` | React context with reducer, sync logic | 517 |
| `src/app/api/session/route.ts` | POST: create session | 40 |
| `src/app/api/session/[id]/route.ts` | GET/PATCH: read/update session | 86 |
| `src/lib/db.ts` | Supabase client + Session type | 22 |

### Current State Shape (UserContext.tsx lines 8-86)

```typescript
{
  sessionId: string | null,
  sessionLoading: boolean,

  user: { name, email, phone, createdAt },

  // Rafael-specific nested objects (PROBLEM: tightly coupled)
  situation: { bookingStatus, dayRate, goal, blocker, confession, ... },
  phase2: { checkFirst, hundredKFollowers, postWorked },
  phase3: { timeOnContent, hardestPart, contentCreatorIdentity },
  phase4: { lastPriceRaise, tooExpensiveResponse, pricingFear },

  progress: {
    currentScreen: "welcome" | "level-flow" | "experience",
    currentPhase: 1-4,
    currentStep: 0-N,
    completedPhases: number[],
    videosWatched: string[],
    justCompletedLevel: boolean
  },

  timeline: { currentPanel, profileComplete },
  memory: [],
  conversation: []
}
```

### Current Sync Flow (UserContext.tsx lines 451-476)

```typescript
// Auto-sync effect - fires on any state change
useEffect(() => {
  if (!state.sessionId || state.sessionLoading) return

  const syncKey = JSON.stringify({ user, situation, phase2, phase3, phase4, progress })
  if (syncKey === lastSyncedRef.current) return

  // 500ms debounce - THIS IS THE RACE CONDITION WINDOW
  const timer = setTimeout(() => {
    lastSyncedRef.current = syncKey
    syncToBackend()  // PATCH /api/session/[id]
  }, 500)

  return () => clearTimeout(timer)
}, [/* all state fields */])
```

### Current Hydration (UserContext.tsx lines 303-322)

```typescript
case 'HYDRATE_FROM_BACKEND': {
  // Spreads backend data over local state
  // NO VERSION CHECK - always overwrites
  return {
    ...state,
    sessionId: backendData.id,
    ...(backendData.context?.progress && {
      progress: { ...state.progress, ...backendData.context.progress }
    }),
    // ... same for situation, phase2, phase3, phase4
  }
}
```

### Current Database Schema (src/lib/db.ts)

```typescript
interface Session {
  id: string
  clerk_user_id: string | null
  clerk_org_id: string
  email: string | null
  phone: string | null
  name: string | null
  supermemory_container: string
  status: 'active' | 'completed' | 'abandoned'
  context: Record<string, any>  // JSON blob with all state
  created_at: string
  updated_at: string
}
```

---

## Target Architecture

### Principle: Server is Truth

```
User clicks "Next" → POST /api/flow/step → DB writes → Return new state → Render
Page refresh → GET /api/session/[id] → Render
```

No local state tracking progress. No debouncing. No hydration conflicts.

### New Session Schema

```typescript
interface Session {
  id: string
  clerk_user_id: string | null
  clerk_org_id: string

  // Flow identification (enables multi-mentor)
  flow_id: string              // e.g., "rafael-tats", "client-1"

  // Progress tracking - just current position
  current_step_id: string      // e.g., "phase-1-step-3"
  // NOTE: No completed_step_ids array. Completed steps are derived from
  // current_step_id + flow definition. Less data, no sync issues.

  // Answers (flat key-value, not nested by phase)
  answers: Record<string, any> // e.g., { "booking-status": "booked-3-months" }

  // Contact info: use existing name/email/phone columns (no new contact JSONB)
  name: string | null
  email: string | null
  phone: string | null

  // Metadata
  supermemory_container: string
  status: 'active' | 'completed' | 'abandoned'
  created_at: string
  updated_at: string
}
```

### Key Changes

| Before | After |
|--------|-------|
| `context.situation.bookingStatus` | `answers["booking-status"]` |
| `context.progress.currentPhase` + `currentStep` | `current_step_id: "phase-1-step-3"` |
| `context.progress.completedPhases: [1, 2]` | Derived from `current_step_id` |
| Nested phase objects | Flat answers object |
| Phase-number-based progress | Step-ID-based progress |

### New API Endpoints

#### POST /api/flow/step
Advance to next step, save answer, return new state.

```typescript
// Request
{
  sessionId: string,
  stepId: string,        // Current step being completed
  answer?: any           // Answer for this step (if applicable)
}

// Response
{
  session: Session,      // Full updated session
  nextStep: StepConfig   // Next step to render (from flow definition)
}
```

#### GET /api/session/[id]
Return full session (unchanged, but with new schema).

#### POST /api/session
Create session with `flow_id`.

```typescript
// Request
{
  clerk_org_id: string,
  flow_id: string        // NEW: which flow to start
}

// Response
{
  sessionId: string,
  session: Session
}
```

### New UserContext (Simplified)

```typescript
// State is just a cache of server data
interface State {
  session: Session | null
  loading: boolean
  error: string | null
}

// Actions
type Action =
  | { type: 'SET_SESSION'; payload: Session }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }

// No more: SET_ANSWER, ADVANCE_STEP, COMPLETE_PHASE, HYDRATE_FROM_BACKEND
// Those all happen server-side now
```

### New Client Flow

```typescript
// On mount
useEffect(() => {
  const sessionId = localStorage.getItem('mentorfy-session-id')
  if (sessionId) {
    fetch(`/api/session/${sessionId}`)
      .then(r => r.json())
      .then(session => dispatch({ type: 'SET_SESSION', payload: session }))
  }
}, [])

// On step complete
async function completeStep(stepId: string, answer?: any) {
  dispatch({ type: 'SET_LOADING', payload: true })

  const res = await fetch('/api/flow/step', {
    method: 'POST',
    body: JSON.stringify({ sessionId: state.session.id, stepId, answer })
  })

  const { session } = await res.json()
  dispatch({ type: 'SET_SESSION', payload: session })
}
```

---

## Migration Plan

### Step 1: Database Migration

Create new columns, migrate existing data:

```sql
-- Add new columns (only 3, not 5)
ALTER TABLE sessions
  ADD COLUMN flow_id TEXT DEFAULT 'rafael-tats',
  ADD COLUMN current_step_id TEXT,
  ADD COLUMN answers JSONB DEFAULT '{}';

-- Migrate existing data
UPDATE sessions SET
  current_step_id = CONCAT(
    'phase-',
    COALESCE(context->'progress'->>'currentPhase', '1'),
    '-step-',
    COALESCE(context->'progress'->>'currentStep', '0')
  ),
  answers = COALESCE(context->'situation', '{}')
    || COALESCE(context->'phase2', '{}')
    || COALESCE(context->'phase3', '{}')
    || COALESCE(context->'phase4', '{}');

-- Note: name/email/phone columns already exist, no migration needed
-- After verification, drop old column:
-- ALTER TABLE sessions DROP COLUMN context;
```

### Step 2: Create New API Endpoint

`src/app/api/flow/step/route.ts`:

```typescript
export async function POST(req: Request) {
  const { sessionId, stepId, answer } = await req.json()

  // 1. Fetch session
  const { data: session } = await db
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  // 2. Save answer if provided
  const answers = answer
    ? { ...session.answers, [stepId]: answer }
    : session.answers

  // 3. Calculate next step
  const flow = getFlow(session.flow_id)
  const nextStepId = flow.getNextStep(stepId)

  // 4. Update session (just current_step_id and answers)
  const { data: updated } = await db
    .from('sessions')
    .update({
      current_step_id: nextStepId,
      answers,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .select()
    .single()

  // 5. Return updated session + next step config
  return NextResponse.json({
    session: updated,
    nextStep: flow.getStep(nextStepId)
  })
}
```

### Step 3: Simplify UserContext

Replace 517-line file with ~100 lines:
- Remove all reducer actions except SET_SESSION, SET_LOADING, SET_ERROR
- Remove sync logic (debounce, lastSyncedRef, syncToBackend)
- Remove hydration logic
- Add `completeStep()` function that calls API

### Step 4: Update Components

Components currently call:
```typescript
dispatch({ type: 'SET_ANSWER', payload: { key: 'situation.bookingStatus', value } })
dispatch({ type: 'ADVANCE_STEP' })
```

Change to:
```typescript
await completeStep('phase-1-step-1', { bookingStatus: value })
// State automatically updates from server response
```

### Step 5: Update Chat API

`src/app/api/chat/route.ts` currently reads:
```typescript
const completedPhases = sessionData.context?.progress?.completedPhases || []
```

Change to:
```typescript
// Derive completed phases from current_step_id
const currentPhase = parseInt(sessionData.current_step_id?.split('-')[1] || '1')
const completedPhases = Array.from({ length: currentPhase - 1 }, (_, i) => i + 1)
```

---

## Files to Modify

| File | Action | Complexity |
|------|--------|------------|
| `src/lib/db.ts` | Update Session interface | Low |
| `src/context/UserContext.tsx` | Rewrite (517 → ~100 lines) | High |
| `src/app/api/session/route.ts` | Add flow_id to creation | Low |
| `src/app/api/session/[id]/route.ts` | Update for new schema | Medium |
| `src/app/api/flow/step/route.ts` | Create new endpoint | Medium |
| `src/app/api/chat/route.ts` | Read from new schema | Low |
| `src/app/rafael-ai/page.tsx` | Use new completeStep() | Medium |
| `src/components/rafael-ai/screens/PhaseFlow.tsx` | Use new completeStep() | Medium |
| `src/types/rafael-ai.ts` | Update types | Low |

---

## Testing Checklist

- [ ] Create new session → has flow_id, current_step_id is first step
- [ ] Complete step with answer → answer in `answers`, current_step_id advances
- [ ] Refresh page mid-flow → resumes at correct step with all answers
- [ ] Complete all steps → status changes to 'completed'
- [ ] Chat API → reads context from `answers` + derives completed phases from step ID
- [ ] No console errors about sync or hydration

---

## Rollback Plan

If issues arise:
1. Keep old `context` column during migration (don't drop immediately)
2. API can fall back to reading from `context` if new columns empty
3. Revert UserContext to old version if needed

---

## Notes for Implementer

1. **Don't optimize prematurely** - Synchronous writes are fine. Supabase latency is <100ms.

2. **Step IDs matter** - Use consistent format like `phase-{N}-step-{M}` so they're sortable and parseable.

3. **Answers are flat** - Don't nest by phase. `{ "booking-status": "x", "day-rate": "y" }` not `{ phase1: { bookingStatus: "x" } }`.

4. **This enables multi-mentor** - The `flow_id` field and step-based progress are designed to work with any flow definition, not just Rafael's.
