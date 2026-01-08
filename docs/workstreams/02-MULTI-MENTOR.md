# Workstream 2: Multi-Mentor Architecture

**Status**: BLOCKING
**Dependencies**: Workstream 1 (State Management) - needs flow-agnostic session schema
**Blocks**: Workstream 3 (PostHog Analytics)

---

## Objective

Decouple the application from Rafael Tats' specific flow so that adding a new mentor/client requires only adding configuration files, not code changes.

---

## Current Problem

### The Coupling

The codebase has 15+ files hardcoded to Rafael's flow. Adding mentor #2 would require:
- Adding new state fields to UserContext
- Creating new components or heavily modifying existing ones
- Duplicating API routes or adding conditionals
- Manually wiring up new agent prompts

### Why It Matters Now

**Launching with a different client, not Rafael.** Rafael Tats is just the dev reference. The launch client needs their own flow, and we need to ship fast.

---

## Current Architecture

### Hardcoded Files Inventory

#### Configuration & Data
| File | Lines | Hardcoding |
|------|-------|------------|
| `src/config/rafael-ai.ts` | 176 | PHASE_NAMES, AUTH_CONFIG |
| `src/data/rafael-ai/mentor.ts` | 69 | Name, avatar, Calendly URL, Whop plan |
| `src/data/rafael-ai/phases.ts` | 276 | All 4 phases, 22 steps, all questions |

#### State Management
| File | Lines | Hardcoding |
|------|-------|------------|
| `src/context/UserContext.tsx` | 38-64 | `situation`, `phase2`, `phase3`, `phase4` nested objects |
| `src/types/rafael-ai.ts` | 158-177 | `Phase2State`, `Phase3State`, `Phase4State` interfaces |

#### API Routes
| File | Lines | Hardcoding |
|------|-------|------------|
| `src/app/api/chat/route.ts` | 10-11 | `import { phases } from '@/data/rafael-ai/phases'` |
| `src/app/api/chat/route.ts` | 139-141 | Comment: "Hardcoded for Rafael - swap when mentor #2 comes" |
| `src/app/api/generate/[type]/route.ts` | 14-17 | TYPE_TO_AGENT maps to `rafael-diagnosis`, `rafael-summary` |

#### Agents
| File | Lines | Hardcoding |
|------|-------|------------|
| `src/agents/registry.ts` | 7-9 | Only registers `rafael-chat`, `rafael-diagnosis`, `rafael-summary` |
| `src/agents/rafael/chat.ts` | 41 | Rafael-specific system prompt |
| `src/agents/rafael/diagnosis.ts` | 22 | "tattoo artist" in prompt |
| `src/agents/rafael/summary.ts` | 20 | "tattoo artist" in prompt |

#### Components
| File | Lines | Hardcoding |
|------|-------|------------|
| `src/app/rafael-ai/page.tsx` | 514 | Entire page is Rafael-specific |
| `src/components/rafael-ai/screens/AIChat.tsx` | 16 | `AGENT_ID = 'rafael-chat'` |
| `src/components/rafael-ai/screens/AIChat.tsx` | 48-80 | Format functions for tattoo artist context |

---

## Target Architecture

### Directory Structure

```
src/
├── data/
│   └── flows/
│       ├── types.ts           # FlowDefinition, PhaseConfig, etc.
│       ├── index.ts           # Flow registry + getFlow()
│       ├── rafael-tats.ts     # Rafael's flow definition
│       └── client-1.ts        # Launch client's flow
│
├── agents/                    # Keep existing structure (prompts in TS files)
│   ├── registry.ts
│   └── rafael/
│       ├── chat.ts
│       ├── diagnosis.ts
│       └── summary.ts
│
├── app/
│   └── [flowId]/              # Dynamic route, not /rafael-ai/
│       └── page.tsx           # Generic flow renderer
│
└── components/
    └── flow/                  # Generic, flow-agnostic components
        └── StepRenderer.tsx
```

### Flow Definition Schema

Each flow is a TypeScript file exporting a `FlowDefinition`:

```typescript
// src/data/flows/types.ts
export interface FlowDefinition {
  id: string                    // "rafael-tats"
  mentor: MentorConfig
  phases: PhaseConfig[]
  agents: AgentConfig
  embeds: EmbedConfig
}

export interface MentorConfig {
  name: string                  // "Rafael Tats"
  handle: string                // "@rafaeltats"
  avatar: string                // "/avatars/rafael.jpg"
  welcome: {
    title: string
    subtitle: string
    videoUrl?: string
  }
}

export interface PhaseConfig {
  id: number                    // 1, 2, 3, 4
  name: string                  // "The Diagnosis"
  steps: StepConfig[]
}

export interface StepConfig {
  type: 'question' | 'ai-moment' | 'sales-page'

  // For questions
  question?: string
  questionType?: 'multiple-choice' | 'long-answer' | 'contact-info'
  options?: { label: string; value: string }[]
  stateKey?: string             // Key path in session context (e.g., "situation.bookingStatus")
  fields?: ContactField[]       // For contact-info type

  // For AI moments
  promptKey?: string
  skipThinking?: boolean

  // For sales pages
  headline?: string
  copyAboveVideo?: string
  copyBelowVideo?: string
  calendlyUrl?: string
}

export interface ContactField {
  key: string
  label: string
  type: 'text' | 'email' | 'tel'
  placeholder: string
  autoComplete?: string
}

export interface AgentConfig {
  chat: {
    model: string
    maxTokens: number
    temperature: number
  }
  diagnosis?: {
    model: string
    maxTokens: number
  }
  summary?: {
    model: string
    maxTokens: number
  }
}

export interface EmbedConfig {
  // Embeds unlock after completing a phase (keep current behavior)
  checkoutAfterPhase?: number   // Phase number that unlocks checkout
  bookingAfterPhase?: number

  // URLs/IDs for embeds
  checkoutPlanId?: string
  calendlyUrl?: string
}
```

### Example Flow Definition

```typescript
// src/data/flows/rafael-tats.ts
import { FlowDefinition } from './types'

export const rafaelTatsFlow: FlowDefinition = {
  id: 'rafael-tats',

  mentor: {
    name: 'Rafael Tats',
    handle: '@rafaeltats',
    avatar: '/avatars/rafael.jpg',
    welcome: {
      title: "Let's unlock your next level",
      subtitle: 'This experience is personalized for you',
      videoUrl: 'https://customer-...'
    }
  },

  phases: [
    {
      id: 1,
      name: 'The Diagnosis',
      steps: [
        {
          type: 'question',
          questionType: 'multiple-choice',
          question: "What stage is your tattoo business at now?",
          stateKey: 'situation.bookingStatus',
          options: [
            { label: 'Fully booked out 3+ months', value: 'booked-3-months' },
            { label: 'Booked out 1-2 months', value: 'booked-1-2-months' },
            // ...
          ]
        },
        // ... more steps
        {
          type: 'ai-moment',
          promptKey: 'phase-1-relief',
          skipThinking: true
        }
      ]
    },
    // ... phases 2, 3, 4
  ],

  agents: {
    chat: {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 1024,
      temperature: 0.7
    },
    diagnosis: {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 512
    }
  },

  embeds: {
    checkoutAfterPhase: 4,
    bookingAfterPhase: 4,
    checkoutPlanId: 'plan_joNwbFAIES0hH',
    calendlyUrl: 'https://calendly.com/brady-mentorfy/30min'
  }
}
```

### Flow Registry

```typescript
// src/data/flows/index.ts
import { rafaelTatsFlow } from './rafael-tats'
import { client1Flow } from './client-1'
import type { FlowDefinition } from './types'

const flows: Record<string, FlowDefinition> = {
  'rafael-tats': rafaelTatsFlow,
  'client-1': client1Flow,
}

export function getFlow(flowId: string): FlowDefinition {
  const flow = flows[flowId]
  if (!flow) throw new Error(`Flow not found: ${flowId}`)
  return flow
}

export function getAllFlowIds(): string[] {
  return Object.keys(flows)
}
```

---

## API Changes

### POST /api/session

Now requires `flow_id`:

```typescript
// Request
{ clerk_org_id: string, flow_id: string }

// Response
{ sessionId: string, session: Session }
```

### POST /api/chat

Get embeds config from flow definition instead of hardcoding:

```typescript
// Current (hardcoded):
import { phases } from '@/data/rafael-ai/phases'
const availableEmbeds = getAvailableEmbeds(completedPhases, phases)

// After (dynamic):
const flow = getFlow(session.flow_id)
const availableEmbeds = getAvailableEmbeds(completedPhases, flow.embeds)
```

### GET /api/flow/[flowId]

New endpoint to fetch flow definition for client rendering:

```typescript
// src/app/api/flow/[flowId]/route.ts
export async function GET(req: Request, { params }: { params: { flowId: string } }) {
  const flow = getFlow(params.flowId)
  return NextResponse.json(flow)
}
```

---

## Component Changes

### Dynamic Route

Replace `/rafael-ai/page.tsx` with `/[flowId]/page.tsx`:

```typescript
// src/app/[flowId]/page.tsx
export default function FlowPage({ params }: { params: { flowId: string } }) {
  const [flow, setFlow] = useState<FlowDefinition | null>(null)
  const { state } = useUser()

  useEffect(() => {
    fetch(`/api/flow/${params.flowId}`)
      .then(r => r.json())
      .then(setFlow)
  }, [params.flowId])

  if (!flow) return <Loading />

  // Get current step using phase/step indices (same as current architecture)
  const { currentPhase, currentStep } = state.progress
  const phase = flow.phases.find(p => p.id === currentPhase)
  const step = phase?.steps[currentStep]

  return <StepRenderer flow={flow} step={step} />
}
```

### Generic Step Renderer

```typescript
// src/components/flow/StepRenderer.tsx
export function StepRenderer({ flow, step, session }: Props) {
  switch (step.type) {
    case 'question':
      return <QuestionStep step={step} />  // Handles multiple-choice, long-answer, contact-info
    case 'ai-moment':
      return <AIMomentStep step={step} flow={flow} />
    case 'sales-page':
      return <SalesPageStep step={step} flow={flow} />
    default:
      return <div>Unknown step type</div>
  }
}
```

---

## Migration Plan

### Step 1: Create Flow Types and Registry

1. Create `src/data/flows/types.ts` with all interfaces
2. Create `src/data/flows/index.ts` with registry
3. Convert `src/data/rafael-ai/phases.ts` → `src/data/flows/rafael-tats.ts`
4. Convert `src/data/rafael-ai/mentor.ts` → merge into flow definition

### Step 2: Update API Routes

1. Update `/api/session` to require `flow_id`
2. Update `/api/chat` to load flow dynamically
3. Update `/api/generate/[type]` to load flow dynamically
4. Create `/api/flow/[flowId]` endpoint

### Step 3: Create Generic Components

1. Create `src/components/flow/StepRenderer.tsx`
2. Create `src/app/[flowId]/page.tsx` (move logic from `/rafael-ai/page.tsx`)

### Step 4: Update Embed Resolution

1. Update `src/lib/embed-resolver.ts` to use flow's `embeds` config (keep phase-based logic)

### Step 5: Delete Rafael-Specific Files

After everything works:
- Delete `src/app/rafael-ai/` directory
- Delete `src/components/rafael-ai/` directory
- Delete `src/data/rafael-ai/` directory (replaced by flows)
- Delete `src/config/rafael-ai.ts` (merged into flow)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/data/flows/types.ts` | TypeScript interfaces |
| `src/data/flows/index.ts` | Flow registry |
| `src/data/flows/rafael-tats.ts` | Rafael's flow (converted from phases.ts + mentor.ts) |
| `src/app/[flowId]/page.tsx` | Dynamic flow page |
| `src/app/api/flow/[flowId]/route.ts` | Flow definition endpoint |
| `src/components/flow/StepRenderer.tsx` | Generic step renderer |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/session/route.ts` | Require flow_id |
| `src/app/api/chat/route.ts` | Get embeds config from flow definition |
| `src/lib/embed-resolver.ts` | Accept flow's embeds config |

## Files to Delete (After Migration)

| File | Reason |
|------|--------|
| `src/app/rafael-ai/` | Replaced by `[flowId]` |
| `src/components/rafael-ai/` | Replaced by `flow/` |
| `src/data/rafael-ai/` | Replaced by `flows/` |
| `src/config/rafael-ai.ts` | Merged into flow definition |
| `src/types/rafael-ai.ts` | Replaced by `flows/types.ts` |

---

## Testing Checklist

- [ ] Rafael flow works exactly as before (regression test)
- [ ] Can navigate to `/rafael-tats` and complete flow
- [ ] Can create new flow file and access at `/new-flow`
- [ ] Embeds resolve correctly based on flow config
- [ ] Session stores correct flow_id
- [ ] No hardcoded "rafael" references in shared code

---

## Adding a New Mentor (Post-Migration)

1. Create `src/data/flows/new-mentor.ts` with flow definition
2. Add mentor's avatar to `public/avatars/`
3. Register in `src/data/flows/index.ts`
4. Done — accessible at `/new-mentor`

**No code changes required.**

---

## Notes for Implementer

1. **TypeScript over JSON** - Keep flow definitions as `.ts` files for type safety. Can move to DB later if needed.

2. **Keep prompts in code for now** - Current prompts live in `src/agents/rafael/*.ts`. Moving to `.md` files can be done later if editing becomes frequent.

3. **Don't over-abstract** - Start with exactly what Rafael needs. Add flexibility only when the second mentor requires it.

4. **Test with Rafael first** - The goal is zero regression. Rafael flow should work identically after migration.
