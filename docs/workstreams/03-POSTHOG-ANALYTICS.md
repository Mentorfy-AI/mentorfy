# Workstream 3: PostHog Analytics

**Status**: BLOCKED
**Dependencies**: Workstream 1 (State Management), Workstream 2 (Multi-Mentor)
**Blocks**: Launch

---

## Objective

Implement user behavior tracking with PostHog to understand funnel performance, drop-off points, and conversion rates across all mentor flows.

---

## Why It's Blocked

PostHog events need to reference a stable data model:

| Event Property | Requires |
|----------------|----------|
| `flow_id` | Multi-mentor architecture (Workstream 2) |
| `step_id` | Flow-agnostic step tracking (Workstream 1) |
| `session_id` | Fixed state management (Workstream 1) |
| `phase_id` | Derived from flow definition (Workstream 2) |

Building analytics on the current broken/coupled architecture means rework later. Wait for foundation to stabilize.

---

## Current State

### What Exists

```
.env.example:
  NEXT_PUBLIC_POSTHOG_KEY=
  NEXT_PUBLIC_POSTHOG_HOST=
```

- Environment variables defined
- **SDK not installed**
- **No implementation code**
- **No events being tracked**

### What's Missing

- `posthog-js` package
- PostHog provider/initialization
- Event tracking calls
- User identification
- Funnel dashboards

---

## Target Implementation

### Event Schema

All events include these base properties (automatically via PostHog):
- `distinct_id` (session ID or user ID)
- `timestamp`
- `$current_url`
- `$device_type`
- `$browser`

Plus our custom properties on every event:
- `flow_id` - Which mentor's flow
- `session_id` - Mentorfy session UUID

### Core Events (7 total)

#### 1. flow_started
Fired when user begins a new flow (first step, no completed steps yet).

```typescript
posthog.capture('flow_started', {
  flow_id: 'rafael-tats',
  session_id: 'uuid',
  utm_source: string | null,
  utm_campaign: string | null,
})
```

#### 2. step_completed
**The core funnel event.** Fired when user completes a step. Drop-off is inferred from gaps (completed step 3 but not step 4 = dropped at step 4).

```typescript
posthog.capture('step_completed', {
  flow_id: 'rafael-tats',
  session_id: 'uuid',

  // Step identification
  step_id: 'phase-2-step-3',
  step_type: 'question' | 'ai-moment' | 'sales-page',
  step_index: 9,              // Overall position in flow (0-indexed across all phases)

  // Phase context (embedded, no reconstruction needed)
  phase_id: 2,
  phase_name: 'Get Booked Without Going Viral',
  phase_step_index: 3,        // Position within this phase (0-indexed)

  // Timing
  time_on_step_ms: 4500,

  // Answer data (for question steps)
  answer_key: 'check-first',           // Which question (null for non-questions)
  answer_value: 'comments',            // Multiple choice value (null for long-form)
  answer_text: 'I have been...',       // Full long-form text (null for multiple choice)
  answer_length: 847,                  // Character count (always present for questions)
})
```

#### 3. phase_completed
Fired when all steps in a phase are done.

```typescript
posthog.capture('phase_completed', {
  flow_id: 'rafael-tats',
  session_id: 'uuid',
  phase_id: 2,
  phase_name: 'Get Booked Without Going Viral',
  phases_completed_so_far: 2,  // Running total
  time_in_phase_ms: 180000,
})
```

#### 4. chat_opened
Fired when user opens chat panel. Chat appears BETWEEN phases, so we track which phases they've completed.

```typescript
posthog.capture('chat_opened', {
  flow_id: 'rafael-tats',
  session_id: 'uuid',
  phases_completed: [1, 2],   // Which phases done before this chat
  chat_version: 2,            // Shorthand: "post-phase-2 chat"
})
```

#### 5. chat_message_sent
Fired when user sends a message.

```typescript
posthog.capture('chat_message_sent', {
  flow_id: 'rafael-tats',
  session_id: 'uuid',
  phases_completed: [1, 2],
  chat_version: 2,
  message_index: 3,           // Nth message in this chat session
  message_length: 150,
})
```

#### 6. embed_shown
Fired when an embed (Calendly, checkout, video) is displayed. Can appear in sales page steps OR in chat via AI tools.

```typescript
posthog.capture('embed_shown', {
  flow_id: 'rafael-tats',
  session_id: 'uuid',
  embed_type: 'booking' | 'checkout' | 'video',
  source: 'sales_page' | 'chat',      // Where the embed appeared
  phases_completed: [1, 2, 3, 4],
})
```

#### 7. booking_clicked
Fired when user clicks Calendly booking. Tracks source to compare sales page vs chat conversion.

```typescript
posthog.capture('booking_clicked', {
  flow_id: 'rafael-tats',
  session_id: 'uuid',
  source: 'sales_page' | 'chat',      // Where they clicked
  phases_completed: [1, 2, 3, 4],
  step_id: 'phase-4-step-6',          // If source = sales_page
  chat_message_index: 12,             // If source = chat (which message had embed)
})
```

### Dropped Events

| Event | Why Dropped |
|-------|-------------|
| `step_viewed` | Redundant — drop-off inferred from `step_completed` gaps |
| `flow_abandoned` | Redundant — inferred from funnel drop-off in PostHog |
| `checkout_initiated` | Not needed — we're booking calls, not selling products |

---

## Implementation Plan

### Step 1: Install and Initialize

```bash
bun add posthog-js
```

Create provider:

```typescript
// src/providers/PostHogProvider.tsx
'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        capture_pageview: false,  // We'll do this manually
        capture_pageleave: true,
        persistence: 'localStorage',
      })
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
```

Add to layout:

```typescript
// src/app/layout.tsx
import { PostHogProvider } from '@/providers/PostHogProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
```

### Step 2: Create Analytics Hook

```typescript
// src/hooks/useAnalytics.ts
import posthog from 'posthog-js'
import { useCallback, useRef } from 'react'
import type { FlowDefinition, StepConfig } from '@/data/flows/types'

interface AnalyticsContext {
  flowId: string
  sessionId: string
}

export function useAnalytics(context: AnalyticsContext) {
  const stepStartTime = useRef<number>(Date.now())
  const phaseStartTime = useRef<number>(Date.now())

  // Call when step renders to start timing
  const startStepTimer = useCallback(() => {
    stepStartTime.current = Date.now()
  }, [])

  // Call when phase starts
  const startPhaseTimer = useCallback(() => {
    phaseStartTime.current = Date.now()
  }, [])

  const trackFlowStarted = useCallback((utmSource?: string, utmCampaign?: string) => {
    posthog.capture('flow_started', {
      flow_id: context.flowId,
      session_id: context.sessionId,
      utm_source: utmSource || null,
      utm_campaign: utmCampaign || null,
    })
  }, [context])

  const trackStepCompleted = useCallback((
    step: StepConfig,
    stepIndex: number,
    phaseId: number,
    phaseName: string,
    phaseStepIndex: number,
    answer?: { key: string; value: string; isLongForm: boolean }
  ) => {
    const timeOnStep = Date.now() - stepStartTime.current
    posthog.capture('step_completed', {
      flow_id: context.flowId,
      session_id: context.sessionId,
      step_id: `phase-${phaseId}-step-${phaseStepIndex}`,
      step_type: step.type,
      step_index: stepIndex,
      phase_id: phaseId,
      phase_name: phaseName,
      phase_step_index: phaseStepIndex,
      time_on_step_ms: timeOnStep,
      answer_key: answer?.key || null,
      answer_value: answer && !answer.isLongForm ? answer.value : null,
      answer_text: answer?.isLongForm ? answer.value : null,
      answer_length: answer?.value?.length || null,
    })
  }, [context])

  const trackPhaseCompleted = useCallback((
    phaseId: number,
    phaseName: string,
    phasesCompletedSoFar: number
  ) => {
    const timeInPhase = Date.now() - phaseStartTime.current
    posthog.capture('phase_completed', {
      flow_id: context.flowId,
      session_id: context.sessionId,
      phase_id: phaseId,
      phase_name: phaseName,
      phases_completed_so_far: phasesCompletedSoFar,
      time_in_phase_ms: timeInPhase,
    })
  }, [context])

  const trackChatOpened = useCallback((phasesCompleted: number[]) => {
    posthog.capture('chat_opened', {
      flow_id: context.flowId,
      session_id: context.sessionId,
      phases_completed: phasesCompleted,
      chat_version: phasesCompleted.length,
    })
  }, [context])

  const trackChatMessage = useCallback((
    messageLength: number,
    messageIndex: number,
    phasesCompleted: number[]
  ) => {
    posthog.capture('chat_message_sent', {
      flow_id: context.flowId,
      session_id: context.sessionId,
      phases_completed: phasesCompleted,
      chat_version: phasesCompleted.length,
      message_index: messageIndex,
      message_length: messageLength,
    })
  }, [context])

  const trackEmbedShown = useCallback((
    embedType: 'booking' | 'checkout' | 'video',
    source: 'sales_page' | 'chat',
    phasesCompleted: number[]
  ) => {
    posthog.capture('embed_shown', {
      flow_id: context.flowId,
      session_id: context.sessionId,
      embed_type: embedType,
      source,
      phases_completed: phasesCompleted,
    })
  }, [context])

  const trackBookingClicked = useCallback((
    source: 'sales_page' | 'chat',
    phasesCompleted: number[],
    stepId?: string,           // If source = sales_page
    chatMessageIndex?: number  // If source = chat
  ) => {
    posthog.capture('booking_clicked', {
      flow_id: context.flowId,
      session_id: context.sessionId,
      source,
      phases_completed: phasesCompleted,
      step_id: stepId || null,
      chat_message_index: chatMessageIndex || null,
    })
  }, [context])

  return {
    startStepTimer,
    startPhaseTimer,
    trackFlowStarted,
    trackStepCompleted,
    trackPhaseCompleted,
    trackChatOpened,
    trackChatMessage,
    trackEmbedShown,
    trackBookingClicked,
  }
}
```

### Step 3: Instrument Step Transitions

```typescript
// src/components/flow/StepRenderer.tsx
import { useAnalytics } from '@/hooks/useAnalytics'

export function StepRenderer({ flow, step, session, phase, stepIndex, phaseStepIndex }: Props) {
  const analytics = useAnalytics({
    flowId: flow.id,
    sessionId: session.id,
  })

  // Start timer on mount
  useEffect(() => {
    analytics.startStepTimer()
  }, [step])

  const handleComplete = async (answer?: any) => {
    // Determine if long-form
    const isLongForm = step.questionType === 'long-answer'

    // Track completion with full context
    analytics.trackStepCompleted(
      step,
      stepIndex,
      phase.id,
      phase.name,
      phaseStepIndex,
      answer ? { key: step.stateKey, value: answer, isLongForm } : undefined
    )

    // Then advance to next step
    await completeStep(step, answer)
  }

  // ... render step
}
```

### Step 4: Instrument Chat

```typescript
// src/components/flow/Chat.tsx
export function Chat({ flow, session, phasesCompleted }: Props) {
  const analytics = useAnalytics({ flowId: flow.id, sessionId: session.id })
  const [messages, setMessages] = useState([])

  // Track chat opened
  useEffect(() => {
    analytics.trackChatOpened(phasesCompleted)
  }, [])

  const handleSend = async (content: string) => {
    analytics.trackChatMessage(content.length, messages.length, phasesCompleted)
    // ... send message
  }

  // Track embeds when they appear in messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.embed) {
      analytics.trackEmbedShown(lastMessage.embed.type, 'chat', phasesCompleted)
    }
  }, [messages])

  // Track booking clicks from chat
  const handleBookingClick = (messageIndex: number) => {
    analytics.trackBookingClicked('chat', phasesCompleted, undefined, messageIndex)
  }

  // ... render chat
}
```

### Step 5: Instrument Sales Page Embeds

```typescript
// In sales page step component
const handleBookingClick = () => {
  analytics.trackEmbedShown('booking', 'sales_page', phasesCompleted)
  analytics.trackBookingClicked('sales_page', phasesCompleted, step.id)
}
```

### Step 6: User Identification

When contact info is collected:

```typescript
// In contact info step completion
const handleContactSubmit = async (contact: { name: string; email: string; phone: string }) => {
  // Identify user in PostHog
  posthog.identify(session.id, {
    email: contact.email,
    name: contact.name,
    phone: contact.phone,
    flow_id: flow.id,
  })

  // Continue with step completion
  await completeStep(step.id, contact)
}
```

### Step 6: Flow Started Event

```typescript
// src/app/[flowId]/page.tsx
export default function FlowPage({ params }: { params: { flowId: string } }) {
  const [hasTrackedStart, setHasTrackedStart] = useState(false)

  useEffect(() => {
    if (session && !hasTrackedStart) {
      // Check if this is a new session (no completed steps)
      if (session.completed_step_ids.length === 0) {
        posthog.capture('flow_started', {
          flow_id: params.flowId,
          session_id: session.id,
          entry_source: getEntrySource(),  // Parse UTM params
          utm_source: new URLSearchParams(window.location.search).get('utm_source'),
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
        })
      }
      setHasTrackedStart(true)
    }
  }, [session])

  // ...
}
```

---

## PostHog Dashboard Setup

### Funnel: Overall Flow Conversion

```
Step 1: flow_started
Step 2: phase_completed (where phase_id = 1)
Step 3: phase_completed (where phase_id = 2)
Step 4: phase_completed (where phase_id = 3)
Step 5: phase_completed (where phase_id = 4)
Step 6: booking_clicked
```

### Funnel: Step-Level Drop-off

Use `step_completed` events with `step_index` to see exact drop-off:

```
Step 1: step_completed (where step_index = 0)
Step 2: step_completed (where step_index = 1)
Step 3: step_completed (where step_index = 2)
... up to max step_index in your flow
```

Filter by `flow_id` to see specific mentor flows.

### Insight: Long-Form Response Review

Create a table insight:
- Event: `step_completed`
- Filter: `answer_text is set`
- Columns: `session_id`, `step_id`, `phase_name`, `answer_text`, `timestamp`
- Sort: Most recent first

This becomes your team's queue for reviewing what users actually wrote.

### Insight: Booking Source Comparison

Compare sales page vs chat conversions:
- Event: `booking_clicked`
- Breakdown by: `source`
- Shows: "X% of bookings from sales_page, Y% from chat"

### Insights to Create

| Insight | Event | Breakdown/Filter | Purpose |
|---------|-------|------------------|---------|
| **Conversion Rate** | `booking_clicked` / `flow_started` | Group by `flow_id` | Compare mentor flows |
| **Drop-off Funnel** | `step_completed` | By `step_index` | See exact drop-off point |
| **Phase Completion** | `phase_completed` | By `phase_id` | Phase-level view |
| **Chat Engagement** | `chat_message_sent` | Avg per session | How much users chat |
| **Chat by Phase** | `chat_message_sent` | By `chat_version` | When users chat most |
| **Answer Distribution** | `step_completed` | By `answer_value` | Multiple choice patterns |
| **Long-Form Review** | `step_completed` | `answer_text is set` | Read actual responses |
| **Booking Source** | `booking_clicked` | By `source` | Sales page vs chat |
| **Time per Step** | `step_completed` | Avg `time_on_step_ms` | Slow steps = friction |
| **Device Breakdown** | `booking_clicked` | By `$device_type` | Mobile vs desktop |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/providers/PostHogProvider.tsx` | PostHog initialization |
| `src/hooks/useAnalytics.ts` | Analytics hook with all track functions |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Wrap with PostHogProvider |
| `src/app/[flowId]/page.tsx` | Track `flow_started` on new sessions |
| `src/components/flow/StepRenderer.tsx` | Track `step_completed` with phase context |
| `src/components/flow/Chat.tsx` | Track `chat_opened`, `chat_message_sent`, `embed_shown`, `booking_clicked` |
| Sales page step component | Track `embed_shown`, `booking_clicked` with `source: 'sales_page'` |
| Contact info step component | Call `posthog.identify()` |

---

## Testing Checklist

- [ ] PostHog events visible in PostHog Live Events view
- [ ] `flow_started` fires once per new session (not on refresh)
- [ ] `step_completed` fires with correct `step_index`, `phase_id`, `phase_name`
- [ ] `step_completed` has `answer_value` for multiple choice, `answer_text` for long-form
- [ ] `phase_completed` fires at end of each phase with `phases_completed_so_far`
- [ ] `chat_opened` fires with correct `phases_completed` array and `chat_version`
- [ ] `chat_message_sent` fires with `message_index` incrementing correctly
- [ ] `embed_shown` fires with correct `source` ('sales_page' or 'chat')
- [ ] `booking_clicked` fires with correct `source` and `step_id` or `chat_message_index`
- [ ] User identified when contact info submitted
- [ ] All events have correct `flow_id` and `session_id`
- [ ] Drop-off funnel shows correct step-by-step progression
- [ ] Long-Form Review insight shows actual `answer_text` content
- [ ] Booking Source insight shows sales_page vs chat breakdown

---

## Privacy Considerations

1. **PII in identify() only** - Email/phone go in `posthog.identify()`, not in event properties
2. **Long-form answers ARE tracked** - Full `answer_text` is captured for review. This is intentional.
3. **Allow opt-out** - Respect Do Not Track header (PostHog handles this)
4. **Data retention** - Configure in PostHog settings based on your compliance needs

---

## Estimated Scope

- Install and configure: 1 hour
- Create analytics hook: 2 hours
- Instrument components: 3 hours
- User identification: 1 hour
- Dashboard setup: 2 hours
- Testing: 2 hours

**Total: ~11 hours**

---

## Notes for Implementer

1. **Wait for Workstreams 1 & 2** - Don't start until `flow_id`, `current_step_id`, and multi-mentor architecture are stable.

2. **Use the hook everywhere** - Don't scatter raw `posthog.capture()` calls. Centralize in `useAnalytics` hook.

3. **Phase context is critical** - Every event needs `phase_id`, `phase_name`, or `phases_completed`. This lets you analyze at both step and phase granularity without reconstructing the flow.

4. **Source tracking for embeds** - Always pass `source: 'sales_page' | 'chat'` to `embed_shown` and `booking_clicked`. This is key for understanding which channel converts better.

5. **Test in PostHog's live view** - Watch events come in real-time during development. Verify all properties are populated correctly.

6. **Filter test traffic** - Use PostHog's internal filtering to exclude your own sessions from dashboards.
