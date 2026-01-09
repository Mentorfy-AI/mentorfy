# PostHog Analytics: Gap Closure Plan

**Status**: Ready to implement
**Prerequisite**: Merge of `chore/posthog-analytics` (done)
**Estimated effort**: 3-4 hours

---

## Gaps Identified

| # | Gap | Severity |
|---|-----|----------|
| 1 | `flow_id` missing from chat events (AIChat doesn't pass flowId to hook) | Critical |
| 2 | Property names are camelCase, spec requires snake_case | Critical |
| 3 | `chat_message_sent` missing `phases_completed`, `chat_after_phase` | Critical |
| 4 | `chat_version` sent as string (`"post-phase-1"`), should be `chat_after_phase` (number) | Medium |
| 5 | `step_completed` missing `step_id`, `phase_step_index`, `time_on_step_ms`, `answer_key`, `answer_length` | High |
| 6 | `embed_shown` missing `phases_completed` | Medium |
| 7 | `booking_clicked` never called | High |
| 8 | `identify()` never called on contact submission | Medium |
| 9 | Step/phase timers not implemented | Low |
| 10 | `flow_started` missing UTM params | Low |

---

## Fix 1: Rewrite `useAnalytics` Hook

Replace `src/hooks/useAnalytics.ts` entirely:

```typescript
'use client'

import { usePostHog } from 'posthog-js/react'
import { useCallback, useRef } from 'react'

export interface AnalyticsContext {
  session_id: string
  flow_id: string
}

export function useAnalytics(context: AnalyticsContext) {
  const posthog = usePostHog()

  // Timers for duration tracking
  const stepStartTime = useRef<number>(Date.now())
  const phaseStartTime = useRef<number>(Date.now())

  // Base properties included in every event
  const baseProps = {
    session_id: context.session_id,
    flow_id: context.flow_id,
  }

  const startStepTimer = useCallback(() => {
    stepStartTime.current = Date.now()
  }, [])

  const startPhaseTimer = useCallback(() => {
    phaseStartTime.current = Date.now()
  }, [])

  // ─────────────────────────────────────────────────────────────
  // flow_started
  // ─────────────────────────────────────────────────────────────
  const trackFlowStarted = useCallback(
    (props?: { utm_source?: string | null; utm_campaign?: string | null }) => {
      posthog?.capture('flow_started', {
        ...baseProps,
        utm_source: props?.utm_source ?? null,
        utm_campaign: props?.utm_campaign ?? null,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // step_completed
  // ─────────────────────────────────────────────────────────────
  const trackStepCompleted = useCallback(
    (props: {
      stepIndex: number          // Overall position in flow (0-indexed across all phases)
      phaseId: number
      phaseName: string
      phaseStepIndex: number     // Position within this phase (0-indexed)
      stepType: string
      answerKey?: string         // Which question (null for non-questions)
      answerValue?: string       // Multiple choice value (null for long-form)
      answerText?: string        // Full long-form text (null for multiple choice)
    }) => {
      const timeOnStep = Date.now() - stepStartTime.current
      posthog?.capture('step_completed', {
        ...baseProps,
        step_id: `phase-${props.phaseId}-step-${props.phaseStepIndex}`,
        step_type: props.stepType,
        step_index: props.stepIndex,
        phase_id: props.phaseId,
        phase_name: props.phaseName,
        phase_step_index: props.phaseStepIndex,
        time_on_step_ms: timeOnStep,
        answer_key: props.answerKey ?? null,
        answer_value: props.answerValue ?? null,
        answer_text: props.answerText ?? null,
        answer_length: props.answerText?.length ?? props.answerValue?.length ?? null,
      })
      // Reset timer for next step
      stepStartTime.current = Date.now()
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // phase_completed
  // ─────────────────────────────────────────────────────────────
  const trackPhaseCompleted = useCallback(
    (props: {
      phaseId: number
      phaseName: string
      phasesCompletedSoFar: number[]
    }) => {
      const timeInPhase = Date.now() - phaseStartTime.current
      posthog?.capture('phase_completed', {
        ...baseProps,
        phase_id: props.phaseId,
        phase_name: props.phaseName,
        phases_completed_so_far: props.phasesCompletedSoFar,
        time_in_phase_ms: timeInPhase,
      })
      // Reset timer for next phase
      phaseStartTime.current = Date.now()
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // chat_opened
  // ─────────────────────────────────────────────────────────────
  const trackChatOpened = useCallback(
    (props: { phasesCompleted: number[]; chatAfterPhase: number }) => {
      posthog?.capture('chat_opened', {
        ...baseProps,
        phases_completed: props.phasesCompleted,
        chat_after_phase: props.chatAfterPhase,  // Which phase was just completed
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // chat_message_sent
  // ─────────────────────────────────────────────────────────────
  const trackChatMessage = useCallback(
    (props: {
      messageIndex: number
      messageLength: number
      phasesCompleted: number[]
      chatAfterPhase: number
    }) => {
      posthog?.capture('chat_message_sent', {
        ...baseProps,
        phases_completed: props.phasesCompleted,
        chat_after_phase: props.chatAfterPhase,
        message_index: props.messageIndex,
        message_length: props.messageLength,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // embed_shown
  // ─────────────────────────────────────────────────────────────
  const trackEmbedShown = useCallback(
    (props: {
      embedType: 'checkout' | 'booking' | 'video'
      source: 'sales_page' | 'chat'
      phasesCompleted: number[]
    }) => {
      posthog?.capture('embed_shown', {
        ...baseProps,
        embed_type: props.embedType,
        source: props.source,
        phases_completed: props.phasesCompleted,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // booking_clicked
  // ─────────────────────────────────────────────────────────────
  const trackBookingClicked = useCallback(
    (props: {
      source: 'sales_page' | 'chat'
      phasesCompleted: number[]
      stepId?: string            // If source = sales_page
      chatMessageIndex?: number  // If source = chat
    }) => {
      posthog?.capture('booking_clicked', {
        ...baseProps,
        source: props.source,
        phases_completed: props.phasesCompleted,
        step_id: props.stepId ?? null,
        chat_message_index: props.chatMessageIndex ?? null,
      })
    },
    [posthog, baseProps]
  )

  // ─────────────────────────────────────────────────────────────
  // identify (call when contact info submitted)
  // ─────────────────────────────────────────────────────────────
  const identify = useCallback(
    (props: { email: string; name?: string; phone?: string }) => {
      posthog?.identify(context.session_id, {
        email: props.email,
        name: props.name,
        phone: props.phone,
        flow_id: context.flow_id,
      })
    },
    [posthog, context]
  )

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
    identify,
  }
}
```

**Key changes:**
- Context requires both `session_id` and `flow_id` (not optional)
- All property names are snake_case
- `baseProps` spread ensures every event has `session_id` and `flow_id`
- `chat_after_phase` is now a number (which phase was just completed)
- `step_completed` has all required properties including `step_id`, `phase_step_index`, `time_on_step_ms`
- Timers implemented via refs

---

## Fix 2: Update AIChat to Pass flowId and phasesCompleted

In `src/components/flow/screens/AIChat.tsx`:

### Change 1: Props interface
```typescript
interface AIChatProps {
  onArrowReady?: () => void
  currentPhase: number
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  continueReady?: boolean
  onContinue?: () => void
  flowId: string                    // ADD
  phasesCompleted: number[]         // ADD
}
```

### Change 2: Destructure and pass to hook
```typescript
export function AIChat({
  onArrowReady,
  currentPhase,
  scrollContainerRef: externalScrollRef,
  continueReady,
  onContinue,
  flowId,                           // ADD
  phasesCompleted,                  // ADD
}: AIChatProps) {
  const state = useUserState()
  const sessionId = useSessionId()

  // FIX: Pass both session_id and flow_id
  const analytics = useAnalytics({
    session_id: sessionId || '',
    flow_id: flowId
  })
```

### Change 3: Update trackChatMessage call
```typescript
// Track chat_message_sent
messageCountRef.current += 1
analytics.trackChatMessage({
  messageIndex: messageCountRef.current,
  messageLength: content.length,
  phasesCompleted: phasesCompleted,      // ADD
  chatAfterPhase: currentPhase,          // ADD (from props)
})
```

### Change 4: Update handleEmbedShown
```typescript
const handleEmbedShown = useCallback((embedType: 'checkout' | 'booking' | 'video') => {
  analytics.trackEmbedShown({
    embedType,
    source: 'chat',
    phasesCompleted: phasesCompleted,  // ADD
  })
}, [analytics, phasesCompleted])
```

---

## Fix 3: Update Page to Pass Props to AIChat

In `src/app/[flowId]/page.tsx`, update the AIChat usage:

```typescript
<AIChat
  onArrowReady={handleArrowReady}
  currentPhase={currentPhaseNumber}
  scrollContainerRef={chatPanelScrollRef}
  continueReady={arrowReady}
  onContinue={handleContinueClick}
  flowId={flow.id}                                    // ADD
  phasesCompleted={state.progress.completedPhases}   // ADD
/>
```

---

## Fix 4: Update trackChatOpened Calls

In `src/app/[flowId]/page.tsx`, fix both `trackChatOpened` calls:

### handleInitialLevelComplete
```typescript
analytics.trackChatOpened({
  phasesCompleted: [...state.progress.completedPhases, currentPhaseNumber],
  chatAfterPhase: currentPhaseNumber,
})
```

### handlePanelLevelComplete
```typescript
analytics.trackChatOpened({
  phasesCompleted: [...state.progress.completedPhases, currentPhaseNumber],
  chatAfterPhase: currentPhaseNumber,
})
```

---

## Fix 5: Update trackStepCompleted in PhaseFlow

In `src/components/flow/screens/PhaseFlow.tsx`:

### Change 1: Calculate overall step index
Need to compute the overall step index across all phases, not just within current phase.

```typescript
// Add helper at component level or compute inline
const getOverallStepIndex = (phaseId: number, phaseStepIndex: number): number => {
  let total = 0
  for (const phase of phases) {
    if (phase.id < phaseId) {
      total += phase.steps.length
    }
  }
  return total + phaseStepIndex
}
```

### Change 2: Update handleAnswer
```typescript
const handleAnswer = async (stateKey: string, value: any) => {
  // Track step_completed with full context
  const step = level!.steps[currentStepIndex]
  const overallStepIndex = getOverallStepIndex(levelId, currentStepIndex)

  // Determine answer type
  const isLongForm = typeof value === 'string' && value.length > 50

  analytics.trackStepCompleted({
    stepIndex: overallStepIndex,
    phaseId: levelId,
    phaseName: level!.name,
    phaseStepIndex: currentStepIndex,
    stepType: step.type,
    answerKey: step.stateKey || stateKey,
    answerValue: isLongForm ? undefined : (typeof value === 'string' ? value : undefined),
    answerText: isLongForm ? value : undefined,
  })

  // ... rest of function unchanged
}
```

### Change 3: Call startStepTimer on step mount
Add effect to start timer when step changes:

```typescript
// In PhaseFlow component, after analytics hook
useEffect(() => {
  analytics.startStepTimer()
}, [currentStepIndex, analytics])
```

---

## Fix 6: Track booking_clicked

### In SalesPageStepContent (PhaseFlow.tsx)

Add tracking when Calendly widget fires `onEventScheduled`:

```typescript
useCalendlyEventListener({
  onEventScheduled: (e) => {
    if (bookingConfirmationSentRef.current) return
    bookingConfirmationSentRef.current = true
    console.log('Call booked:', e.data.payload)

    // ADD: Track booking_clicked
    analytics.trackBookingClicked({
      source: 'sales_page',
      phasesCompleted: state.progress?.completedPhases || [],
      stepId: `phase-${/* current phase */}-step-${/* current step */}`,
    })

    setActionComplete(true)
  },
})
```

Note: SalesPageStepContent needs access to analytics and state. May need to pass these as props or restructure.

### In AIChat (for chat-based bookings)

When booking embed is clicked from chat, track it. This requires adding an `onBookingClick` callback to the booking embed component.

---

## Fix 7: Call identify() on Contact Submission

In `src/components/flow/screens/PhaseFlow.tsx`, in `ContactInfoStepContent`:

```typescript
const handleSubmit = async () => {
  if (!isValid) return

  // Update contact info on server
  await updateContact(values)

  // ADD: Identify user in PostHog
  analytics.identify({
    email: values.email,
    name: values.name,
    phone: values.phone,
  })

  // Advance to next step
  onAnswer(step.stateKey, values)
}
```

Note: `ContactInfoStepContent` needs access to `analytics`. Pass as prop.

---

## Fix 8: Add UTM Tracking to flow_started

In `src/app/[flowId]/page.tsx`:

```typescript
const handleStartFromWelcome = () => {
  if (!flowStartedRef.current && state.sessionId) {
    flowStartedRef.current = true

    // Get UTM params from URL
    const params = new URLSearchParams(window.location.search)

    analytics.trackFlowStarted({
      utm_source: params.get('utm_source'),
      utm_campaign: params.get('utm_campaign'),
    })
  }
  dispatch({ type: 'SET_SCREEN', payload: 'level-flow' })
}
```

---

## Fix 9: Update useAnalytics Hook Initialization

All call sites must now pass both `session_id` and `flow_id`. Update:

### In page.tsx (already correct)
```typescript
const analytics = useAnalytics({
  session_id: state.sessionId || '',
  flow_id: flow.id
})
```

### In PhaseFlow.tsx
```typescript
const analytics = useAnalytics({
  session_id: state.sessionId || '',
  flow_id: flowId
})
```

### In AIChat.tsx
```typescript
const analytics = useAnalytics({
  session_id: sessionId || '',
  flow_id: flowId  // Now passed as prop
})
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useAnalytics.ts` | Complete rewrite per Fix 1 |
| `src/app/[flowId]/page.tsx` | Pass props to AIChat, fix trackChatOpened, add UTM tracking |
| `src/components/flow/screens/AIChat.tsx` | Add flowId/phasesCompleted props, update all tracking calls |
| `src/components/flow/screens/PhaseFlow.tsx` | Fix trackStepCompleted, add startStepTimer effect, add identify call, add booking tracking |

---

## Testing Checklist

After implementation, verify in PostHog Live Events:

- [ ] Every event has `session_id` and `flow_id` (snake_case)
- [ ] `flow_started` has `utm_source`, `utm_campaign` (or null)
- [ ] `step_completed` has `step_id`, `phase_step_index`, `time_on_step_ms`, `answer_key`, `answer_length`
- [ ] `phase_completed` has `time_in_phase_ms`
- [ ] `chat_opened` has `chat_after_phase` as number
- [ ] `chat_message_sent` has `phases_completed`, `chat_after_phase` as number
- [ ] `embed_shown` has `phases_completed`
- [ ] `booking_clicked` fires when Calendly booking completes
- [ ] User is identified when contact info submitted
- [ ] All events can be filtered by `flow_id` in PostHog

---

## PostHog Insight Fixes

After code is fixed, update/recreate insights:

| Insight | Filter to Add |
|---------|---------------|
| All funnels | Add `flow_id = X` filter |
| User Funnel: Start to Chat | Use `chat_after_phase` for breakdown |
| Step Drop-off | Use `step_index` for ordered funnel steps |
| Chat by Phase | Breakdown by `chat_after_phase` |

---

## Notes

1. **Breaking change**: `useAnalytics` now requires both `session_id` and `flow_id`. All existing call sites must be updated.

2. **Timer accuracy**: Step timers reset on each step completion. If user leaves and returns, time will be from when they returned, not original start. This is acceptable for v1.

3. **Booking tracking scope**: Currently only covers Calendly in sales page. Chat-based booking tracking needs the embed component to expose a callback.
