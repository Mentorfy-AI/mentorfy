# Plan: Replace Embed Markers with AI SDK Tools

## Problem Statement

The chat interface needs to show embedded content (checkout forms, videos, booking calendars) within AI responses. Currently, the AI agent outputs special text markers like `[[CHECKOUT]]` in its responses, and the frontend parses these markers to render embeds.

**The problem:** Users see the raw marker text (e.g., `[[CHECKOUT]]`) flash on screen during streaming before it gets replaced with the actual embed. This creates a jarring UX.

---

## Current Implementation

### How it works today

1. **System prompt** (`/agents/rafael/chat.ts`) tells the agent to output markers:
   ```
   When the user is ready to buy, output:

   Perfect timing. Let me show you...

   [[CHECKOUT]]

   The price goes up soon...
   ```

2. **API route** (`/api/chat/route.ts`) uses `streamText()` and returns `toTextStreamResponse()` - plain text only.

3. **useAgent hook** (`/hooks/useAgent.ts`) manually parses the response as a raw text stream, accumulating bytes into a string.

4. **AIChat component** (`/components/rafael-ai/screens/AIChat.tsx`) has a `parseEmbedMarkers()` function that runs *after* streaming completes:
   ```typescript
   const embedData = parseEmbedMarkers(finalText)
   if (embedData) {
     // Replace message content with embed
   }
   ```

### Why markers flash during streaming

The marker detection happens *after* the stream ends. During streaming, the raw text (including `[[CHECKOUT]]`) is displayed character by character. Only when streaming completes does the frontend parse and replace.

---

## Proposed Solution

Use **Vercel AI SDK tools** instead of text markers.

Instead of the agent outputting `[[CHECKOUT]]`, it calls a tool:
```
showCheckout({ beforeText: "Perfect timing...", afterText: "The price goes up..." })
```

### Why this solves the problem

- Tool calls are separate stream parts, not inline text
- The frontend receives tool calls as structured data immediately
- No marker text ever renders - we know it's an embed from the stream metadata
- The AI SDK handles all the parsing

---

## Why This Approach

| Approach | Pros | Cons |
|----------|------|------|
| **Text markers** (current) | Simple prompt | Markers flash during stream |
| **Prefix detection** (`[EMBED:checkout]` at start) | Works with current setup | Fragile, still parsing text |
| **Structured JSON output** | Type-safe | Changes entire response format |
| **AI SDK tools** (proposed) | Clean separation, built-in streaming support, extensible | Requires useChat migration |

Tools are the cleanest solution because:
1. Text stays as text, embeds are explicit actions
2. AI SDK already handles tool call streaming
3. Adding new embed types = adding new tools
4. Matches how agents naturally "do things"

---

## Technical Changes

### 1. API Route

**File:** `/api/chat/route.ts`

**Current:**
```typescript
const result = streamText({
  model: anthropic(agent.model),
  system: systemPrompt,
  messages,
})

return result.toTextStreamResponse()
```

**After:**
```typescript
const result = streamText({
  model: anthropic(agent.model),
  system: systemPrompt,
  messages,
  tools: {
    showCheckout: {
      description: 'Show checkout embed when user is ready to purchase',
      parameters: z.object({
        beforeText: z.string().describe('Text to display before the embed'),
        afterText: z.string().describe('Text to display after the embed'),
      }),
    },
    showVideo: {
      description: 'Show video embed when sharing a key insight',
      parameters: z.object({
        beforeText: z.string(),
        afterText: z.string(),
      }),
    },
    showBooking: {
      description: 'Show booking calendar when user is ready to schedule',
      parameters: z.object({
        beforeText: z.string(),
        afterText: z.string(),
      }),
    },
  },
})

return result.toUIMessageStreamResponse()
```

Tools have no `execute` function - they're UI-only. The frontend renders them.

---

### 2. System Prompt

**File:** `/agents/rafael/chat.ts`

**Remove:** The entire "Embedded Content" section (lines 20-54) documenting `[[CHECKOUT]]`, `[[VIDEO]]`, `[[BOOKING]]` markers.

**Add:** Tool usage instructions:
```
## Embedded Content

You have tools to show embedded content. Use them when contextually appropriate.

- `showCheckout`: When the user is ready to buy or asks about purchasing
- `showVideo`: When sharing a key insight they need to see
- `showBooking`: When the user is ready to schedule a call

Include natural framing in beforeText and afterText parameters.
```

---

### 3. useAgent Hook

**File:** `/hooks/useAgent.ts`

This hook currently does two things:
1. `sendMessage` - Chat streaming (will be replaced by `useChat`)
2. `getResponse` - PhaseFlow diagnosis generation (keep this)

**Keep:**
- `getResponse` function (calls `/api/generate/diagnosis`)
- Loading/error states for diagnosis

**Remove:**
- `sendMessage` function
- `messagesRef`
- `cancel` function
- `clearHistory` function

The hook becomes diagnosis-only. Chat moves to `useChat`.

---

### 4. AIChat Component

**File:** `/components/rafael-ai/screens/AIChat.tsx`

**Remove:**
```typescript
// These go away
const EMBED_MARKERS = {
  '[[CHECKOUT]]': { embedType: 'checkout', ... },
  ...
}

function parseEmbedMarkers(text: string): EmbedData | null {
  // ...
}

// And the post-stream marker detection:
const embedData = parseEmbedMarkers(finalText)
```

**Add:**
```typescript
import { useChat } from '@ai-sdk/react'

const { messages, append, isLoading, setMessages } = useChat({
  api: '/api/chat',
  body: { sessionId, agentId: 'rafael-chat' },
})
```

**Message rendering:**

`useChat` messages have a `toolInvocations` array:
```typescript
message.toolInvocations = [
  {
    toolName: 'showCheckout',
    args: { beforeText: '...', afterText: '...' },
    state: 'result'
  }
]
```

Map tool invocations to existing `embedData` format:
```typescript
if (message.toolInvocations?.some(t => t.toolName === 'showCheckout')) {
  const tool = message.toolInvocations.find(t => t.toolName === 'showCheckout')
  const embedData = {
    embedType: 'checkout',
    beforeText: tool.args.beforeText,
    afterText: tool.args.afterText,
    checkoutPlanId: mentor.whopPlanId,
  }
  // Render using existing EmbeddedRafaelMessage component
}
```

---

## What Stays Unchanged

- **Embed rendering components:** `RenderEmbed`, `EmbeddedRafaelMessage`, `CompletedEmbeddedMessage`
- **`EmbedData` type** in `/types/rafael-ai.ts`
- **`mentor.ts` config** (URLs for checkout, calendly, videos)
- **PhaseFlow component** and its sales-page steps
- **`/api/generate/diagnosis` endpoint**
- **All embed UI/styling**

We're only changing *how embeds are detected*, not how they're rendered.

---

## Migration Steps

1. **API route:** Add tools, change to `toUIMessageStreamResponse()`
2. **System prompt:** Replace marker docs with tool docs
3. **useAgent:** Remove `sendMessage`, keep `getResponse`
4. **AIChat:** Switch to `useChat`, map `toolInvocations` to `embedData`
5. **Test:** Verify embeds render without marker flash
6. **Cleanup:** Remove dead marker code

Steps 1-2 are backend, steps 3-4 are frontend. Deploy together since they depend on each other.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent doesn't use tools correctly | Embeds don't appear | Tune prompt, test with various user inputs |
| useChat message format mismatch | Rendering breaks | Map to existing embedData shape, keep render components |
| Streaming UX changes | User notices difference | useChat streams similarly, test feels the same |
| PhaseFlow breaks | Diagnosis AI moments fail | getResponse is untouched, separate code path |
| Multiple tool calls per message | Unexpected UI | Decide policy: render first tool only, or support multiple |

---

## Success Criteria

1. User never sees `[[CHECKOUT]]` or any marker text
2. Embeds appear smoothly during/after streaming
3. Checkout, video, and booking embeds all work
4. PhaseFlow AI moments unaffected
5. No regression in chat functionality
