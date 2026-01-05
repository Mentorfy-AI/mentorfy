# Branch Gaps: fresh-build vs main

This document captures the functionality gaps between the `fresh-build` branch (backend-integrated) and the `main` branch (frontend prototype), plus historical context on orphaned features.

---

## Executive Summary

| Branch | Purpose |
|--------|---------|
| `main` | Frontend prototype with mock data, all UI interactions working |
| `fresh-build` | Backend-integrated version with real APIs, some frontend features orphaned |

**Key Issue:** During backend integration, several frontend interaction triggers were removed or lost.

---

## 1. Orphaned: DEMO_COMMANDS (Chat Embeds)

### What It Was

In `main`, users could type specific phrases in the chat to trigger embedded content:

```typescript
// Location: src/components/rafael-ai/screens/AIChat.tsx (main branch)

const DEMO_COMMANDS = {
  'sell me': {
    beforeText: `Perfect timing. Let me show you exactly what you'll get...`,
    embedType: 'checkout',
    checkoutPlanId: 'plan_joNwbFAIES0hH',
    afterText: `**What's included:**\n• 12 weeks of intensive coaching...`
  },
  'video': {
    beforeText: `I want to show you something that changed everything...`,
    embedType: 'video',
    videoUrl: 'https://rafaeltats.wistia.com/medias/4i06zkj7fg',
    afterText: `**Key takeaways from the video:**...`
  },
  'book me': {
    beforeText: `Let's get you on my calendar...`,
    embedType: 'booking',
    calendlyUrl: 'https://calendly.com/brady-mentorfy/30min',
    afterText: `**What we'll cover on the call:**...`
  }
}
```

### What Happens Now

- **The embed components still exist** (`ChatCheckoutEmbed`, `ChatVideoEmbed`, `ChatBookingEmbed`, `EmbeddedRafaelMessage`)
- **But the trigger logic was removed** - replaced with streaming API calls
- **Result:** Users cannot trigger checkout, video, or booking embeds in chat

### How to Restore

In `AIChat.tsx`, add demo command check before the streaming API call:

```typescript
// In handleSendMessage, before API call:
const normalizedContent = content.toLowerCase().trim()
const demoCommand = DEMO_COMMANDS[normalizedContent]

if (demoCommand) {
  // Handle demo command with embedded content (restore original logic)
  return
}

// Otherwise, proceed with streaming API
```

---

## 2. Orphaned: Sales Page Step (Phase-Level Checkout/Booking)

### Historical Context

**Commit `4496370`** (Dec 28, 2025) introduced sales-page steps at the end of phases:

```javascript
// Original levels.js - Phase 1 ended with:
{
  type: "sales-page",
  videoKey: "level-1-intro",
  checkoutPlanId: "plan_joNwbFAIES0hH"  // Whop checkout
}

// Phase 2 ended with:
{
  type: "sales-page",
  variant: "calendly",
  calendlyUrl: "https://calendly.com/brady-mentorfy/30min"
}
```

**Commit `1aa2f9e`** (Jan 2, 2026) removed these steps during a UX refactor.

### What Exists Now

The `SalesPageStepContent` component in `PhaseFlow.tsx` is fully functional with two variants:

| Variant | Trigger | Content |
|---------|---------|---------|
| `checkout` (default) | `checkoutPlanId` present | "Here's what I see" + Whop embed |
| `calendly` | `variant: 'calendly'` | "You're a great fit for 1-on-1" + Calendly embed |

### How to Restore

Add a `sales-page` step to `src/data/rafael-ai/phases.ts`:

```typescript
// Example: Add to end of Phase 4
{
  type: "sales-page",
  variant: "calendly",
  calendlyUrl: "https://calendly.com/brady-mentorfy/30min"
}
```

Or for checkout:

```typescript
{
  type: "sales-page",
  checkoutPlanId: "plan_joNwbFAIES0hH"
}
```

---

## 3. Features Added in fresh-build (Keep These)

| Feature | Location | Purpose |
|---------|----------|---------|
| Auth Gating | `useAuthGate.ts`, `page.tsx` | Requires sign-in after Phase 1 completion |
| Clerk Integration | `layout.tsx`, `page.tsx` | UserButton, SignIn modal |
| Session Management | `UserContext.tsx`, API routes | Backend session sync |
| Returning User Detection | `PhaseFlow.tsx:201-343` | "Welcome back" flow for existing users |
| File Upload | `ChatBar.tsx:322-366` | Upload images to chat |
| Streaming Responses | `useAgent.ts` | Real-time AI response streaming |
| Backend APIs | `src/app/api/*` | Session, chat, upload, transcribe, generate |

---

## 4. Files That Differ

| File | Main Has | Fresh-Build Has |
|------|----------|-----------------|
| `AIChat.tsx` | DEMO_COMMANDS, mock getResponse | Streaming sendMessage, no demo commands |
| `useAgent.ts` | mockResponses import | Real API calls with streaming |
| `UserContext.tsx` | Local state only | Backend sync, session management |
| `ChatBar.tsx` | Basic input | File upload support |
| `page.tsx` | Dimmed account button | Clerk UserButton + auth gating |
| `PhaseFlow.tsx` | Basic form submit | Returning user detection |

### Files Only in Main

- `src/data/rafael-ai/mockResponses.ts` - Mock AI responses (fallback)
- `src/lib/api.ts` - API utilities

### Files Only in Fresh-Build

- `src/app/api/*` - Backend API routes
- `src/hooks/useAuthGate.ts` - Auth gating hook
- `src/lib/db.ts`, `langfuse.ts`, `ratelimit.ts`, `supermemory.ts` - Backend libs
- `src/middleware.ts` - Next.js middleware
- `src/agents/` - AI agent definitions

---

## 5. Embed Types Reference

### Chat Embeds (DEMO_COMMANDS)

Triggered by typing specific phrases in chat:

| Phrase | Embed Type | Component |
|--------|------------|-----------|
| "sell me" | Whop Checkout | `ChatCheckoutEmbed` |
| "video" | Wistia Video | `ChatVideoEmbed` |
| "book me" | Calendly Booking | `ChatBookingEmbed` |

### Phase Step Embeds (sales-page)

Triggered as a step in phase flow:

| Variant | Embed | Copy |
|---------|-------|------|
| `checkout` (default) | Whop Checkout | "Here's what I see..." |
| `calendly` | Calendly Booking | "You're a great fit for 1-on-1..." |

---

## 6. Config Values

Located in `src/data/rafael-ai/mentor.ts` (fresh-build) or hardcoded (main):

```typescript
{
  whopPlanId: "plan_joNwbFAIES0hH",
  calendlyUrl: "https://calendly.com/brady-mentorfy/30min",
  videos: {
    'welcome-vsl': { url: 'https://rafaeltats.wistia.com/medias/4i06zkj7fg' }
  }
}
```

---

## 7. Restoration Checklist

### To restore full functionality:

- [x] **Embedded content in chat** - Agent outputs `[[CHECKOUT]]`, `[[VIDEO]]`, `[[BOOKING]]` markers
- [x] **Sales page after Phase 4** - Added `sales-page` step to `phases.ts`
- [ ] **Mock responses fallback** - Consider restoring `mockResponses.ts` for offline/error cases

### Already working in fresh-build:

- [x] Auth gating after Phase 1
- [x] File uploads in chat
- [x] Streaming AI responses
- [x] Session persistence
- [x] Returning user detection

---

## 8. Git References

| Commit | Description |
|--------|-------------|
| `4496370` | Added sales-page steps + DEMO_COMMANDS |
| `1aa2f9e` | Removed sales-page steps from phases |
| `fb42a2f` | Migration to Next.js/TypeScript |
| `7cc0bca` | Renamed levels → phases |

To see original levels with sales-page:
```bash
git show 4496370:src/data/rafael-ai/levels.js
```

To see DEMO_COMMANDS in main:
```bash
git show main:src/components/rafael-ai/screens/AIChat.tsx | grep -A50 "DEMO_COMMANDS"
```
