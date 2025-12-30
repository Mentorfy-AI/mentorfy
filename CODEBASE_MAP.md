# Mentorfy Codebase Map

Complete analysis of the Rafael AI frontend codebase.

---

## STEP 1: File Structure

```
src/
├── app/
│   ├── globals.css                    # Global styles, font imports, Tailwind
│   ├── layout.tsx                     # Root layout, UserProvider, fonts (Geist, Lora)
│   ├── page.tsx                       # Redirects to /rafael-ai
│   └── rafael-ai/
│       └── page.tsx                   # Main app orchestrator (state machine)
│
├── components/
│   └── rafael-ai/
│       ├── layouts/
│       │   ├── AppShell.tsx           # Animated page wrapper with transitions
│       │   └── ExperienceShell.tsx    # Horizontal scroll container (3-panel timeline)
│       │
│       ├── screens/
│       │   ├── WelcomeScreen.tsx      # Landing page with VSL video
│       │   ├── LevelFlow.tsx          # Step-by-step question/video/AI flow (BIG file)
│       │   ├── ActiveChat.tsx         # Real-time chat interface
│       │   ├── ChatHome.tsx           # Post-level summary page
│       │   ├── PastView.tsx           # Journey summary (typewriter effect)
│       │   ├── PresentView.tsx        # Chat view in timeline mode
│       │   └── FutureView.tsx         # Wrapper for LevelFlow in timeline mode
│       │
│       └── shared/
│           ├── Avatar.tsx             # Rafael's profile picture
│           ├── RafaelLabel.tsx        # "Rafael Tats" + verified badge
│           ├── ChatInputBar.tsx       # Text input + voice recording + send
│           ├── LiquidGlassHeader.tsx  # Frosted glass header bar
│           ├── ProgressIndicator.tsx  # Step progress dots
│           ├── ThinkingAnimation.tsx  # Typewriter "thinking" animation
│           ├── VideoEmbed.tsx         # YouTube/Vimeo/Wistia player
│           ├── MentorfyWatermark.tsx  # Footer branding
│           └── NextArrow.tsx          # Navigation arrow buttons
│
├── context/
│   └── UserContext.tsx                # Global state (user data, progress, answers)
│
├── data/
│   └── rafael-ai/
│       ├── levels.ts                  # Level configurations (questions, steps)
│       ├── mentor.ts                  # Rafael's profile, video URLs
│       └── mockResponses.ts           # AI response templates
│
├── hooks/
│   └── useAgent.ts                    # Mock AI response hook
│
└── lib/
    └── api.ts                         # Claude API config (placeholder, not integrated)
```

---

## STEP 2: Screen Inventory

| Screen Name | File Path | What It Does | When User Sees It |
|-------------|-----------|--------------|-------------------|
| Welcome Screen | `screens/WelcomeScreen.tsx` | Landing page with Rafael's VSL video, headline, and "Show Me How" CTA button | First visit, before any interaction |
| Level Flow | `screens/LevelFlow.tsx` | Step-by-step experience: questions, AI moments, videos, sales pages | After clicking "Show Me How" or starting a new level |
| Active Chat | `screens/ActiveChat.tsx` | Real-time chat conversation with Rafael | Currently unused in main flow (legacy) |
| Chat Home | `screens/ChatHome.tsx` | Post-level completion summary with insights and "Continue to Level X" CTA | After completing a level |
| Past View | `screens/PastView.tsx` | Journey summary showing what user learned, typewriter text effect | Timeline mode: swipe left from Present |
| Present View | `screens/PresentView.tsx` | Chat interface with level completion message, ability to chat | Timeline mode: center panel |
| Future View | `screens/FutureView.tsx` | Wrapper that renders LevelFlow for next level | Timeline mode: swipe right from Present |

---

## STEP 3: Component Inventory

### Layout Components

| Component Name | File Path | What It Is | Where It's Used |
|----------------|-----------|------------|-----------------|
| AppShell | `layouts/AppShell.tsx` | Animated page wrapper with enter/exit transitions | Not currently used (legacy) |
| ExperienceShell | `layouts/ExperienceShell.tsx` | Horizontal scroll container with snap points for 3 panels | Timeline mode (Past/Present/Future) |
| Panel | `layouts/ExperienceShell.tsx` | Individual panel inside ExperienceShell (100vw width) | Timeline mode panels |

### Shared UI Components

| Component Name | File Path | What It Is | Where It's Used |
|----------------|-----------|------------|-----------------|
| Avatar | `shared/Avatar.tsx` | Rafael's circular profile image with black glow | Headers, chat messages |
| RafaelLabel | `shared/RafaelLabel.tsx` | "Rafael Tats" text + green verified checkmark badge | Headers |
| ChatInputBar | `shared/ChatInputBar.tsx` | Text input with voice recording, mic button, send button | ChatHome, PastView, PresentView, ActiveChat |
| LiquidGlassHeader | `shared/LiquidGlassHeader.tsx` | Frosted glass header with back arrow, avatar, account icon | FutureView, and inline in other screens |
| ProgressIndicator | `shared/ProgressIndicator.tsx` | Dots showing current step in level flow | LevelFlow |
| ThinkingAnimation | `shared/ThinkingAnimation.tsx` | Typewriter effect with blinking cursor for "thinking" messages | AI moments in LevelFlow |
| VideoEmbed | `shared/VideoEmbed.tsx` | Video player supporting YouTube, Vimeo, Wistia | WelcomeScreen, LevelFlow, PresentView |
| MentorfyWatermark | `shared/MentorfyWatermark.tsx` | Footer branding with eye logo | WelcomeScreen |
| NextArrow | `shared/NextArrow.tsx` | Green arrow button for navigation | FutureView, Timeline navigation |

### Components Inside LevelFlow (not separate files)

| Component Name | What It Is | Where It's Used |
|----------------|------------|-----------------|
| MultipleChoiceQuestion | Renders multiple choice options | Question steps |
| LongAnswerQuestion | Textarea for long-form answers | Open-ended questions |
| ContactInfoQuestion | Name/email/phone form | User info collection |
| AIMomentView | Shows Rafael's AI-generated response | After questions |
| VideoStep | Video with intro text | Teaching moments |
| SalesPage | Checkout embed (Whop) or Calendly booking | End of levels |
| StreamingMessage | Typewriter effect for AI responses | AI moments |

### Components Inside PresentView (not separate files)

| Component Name | What It Is | Where It's Used |
|----------------|------------|-----------------|
| UserBubble | Green chat bubble for user messages | Chat interface |
| RafaelMessage | Rafael's message with formatting | Chat interface |
| ThinkingIndicator | "Thinking..." with shimmer animation | While waiting for response |
| StreamingRafaelMessage | Typewriter streaming for responses | Chat responses |
| EmbeddedRafaelMessage | Message with video/checkout/booking embed | Demo commands |
| ChatCheckoutEmbed | Whop checkout inline | "sell me" command |
| ChatVideoEmbed | Video player inline | "video" command |
| ChatBookingEmbed | Calendly inline widget | "book me" command |

---

## STEP 4: User Flow Map

### Main Flow (First Visit)

```
1. User lands on → "/" → Redirects to "/rafael-ai"

2. User sees → WelcomeScreen (src/app/rafael-ai/page.tsx renders it)
   - Rafael's headline: "Steal The Method..."
   - VSL video (Wistia embed)
   - "Show Me How" button

3. User clicks "Show Me How" → LevelFlow (Level 1)
   - Progress: currentScreen = "level", currentLevel = 1, currentStep = 0

4. Level 1 Steps (defined in data/rafael-ai/levels.ts):
   Step 0: "What stage is your tattoo business at now?" (multiple choice)
   Step 1: "What's your day rate?" (multiple choice)
   Step 2: "Where do you want to be in 3-6 months?" (multiple choice)
   Step 3: "What's stopping you from being there now?" (multiple choice)
   Step 4: Contact info form (name, email, phone)
   Step 5: Long answer: "Be honest with me..." (textarea)
   Step 6: AI Moment - Rafael's diagnosis based on answers
   Step 7: Video - "What I'm about to show you..."
   Step 8: Sales Page - Whop checkout ($100 Level 2 purchase)

5. User completes Level 1 → dispatch COMPLETE_LEVEL
   - progress.completedLevels = [1]
   - progress.currentLevel = 2
   - progress.justCompletedLevel = true

6. User sees → Timeline Mode (ExperienceShell with 3 panels)
   - Panel 0 (Past): PastView - "Your journey so far..."
   - Panel 1 (Present): PresentView - Level completion message + chat
   - Panel 2 (Future): FutureView - LevelFlow for Level 2

7. User can:
   - Swipe left → Past (journey summary)
   - Stay center → Present (chat with Rafael)
   - Swipe right → Future (start Level 2)
   - Type in chat → Gets AI response (mock)
```

### Chat Flow (In PresentView)

```
1. User types message → handleSendMessage()
2. Check for demo commands:
   - "sell me" → Shows checkout embed
   - "video" → Shows video embed
   - "book me" → Shows Calendly embed
3. If not demo command → useAgent().getResponse()
4. Shows "Thinking..." indicator with timer
5. Response streams in with typewriter effect
6. Message saved to state.conversation
```

### State Machine in rafael-ai/page.tsx

```
currentScreen values:
- "welcome"  → renders WelcomeScreen
- "level"    → renders LevelFlow
- "chatHome" → NOT USED (legacy)
- "timeline" → renders ExperienceShell with Past/Present/Future
```

---

## STEP 5: Naming Confusion Report

### Files That Don't Match What They Do

| File | Current Name | What It Actually Does | Suggested Name |
|------|--------------|----------------------|----------------|
| `ActiveChat.tsx` | "Active Chat" | Generic chat UI, NOT currently used | `LegacyChat.tsx` or delete |
| `ChatHome.tsx` | "Chat Home" | Post-level summary, NOT a chat home | `LevelCompleteSummary.tsx` |
| `FutureView.tsx` | "Future View" | Just wraps LevelFlow | `LevelPanel.tsx` |

### Generic/Confusing Names

| Current Name | Problem | What It Actually Is |
|--------------|---------|---------------------|
| `AppShell` | Too generic | Animated page wrapper (not used) |
| `ExperienceShell` | Vague | Horizontal scroll timeline container |
| `Panel` | Too generic | 100vw scrollable section |
| `levels.ts` | Ambiguous | Level step configurations |
| `mentor.ts` | Vague | Rafael's profile and video data |

### Multiple Names for Same Concept

| Concept | Names Used | Files |
|---------|------------|-------|
| Rafael's responses | "AI moment", "diagnosis", "response", "message" | levels.ts, mockResponses.ts, LevelFlow.tsx |
| User progress | "step", "currentStep", "progress" | UserContext.tsx, LevelFlow.tsx |
| The questionnaire flow | "level", "LevelFlow", "steps" | Multiple files |
| The chat interface | "chat", "conversation", "PresentView" | Multiple files |

### Inconsistent Terminology

| In Code | In UI | Notes |
|---------|-------|-------|
| `currentScreen` | N/A | Internal state only |
| `timeline` | N/A | The 3-panel swipe view |
| `AIMomentView` | "Rafael speaks" | Confusing - sounds like AI is watching |
| `SalesPage` | Checkout screen | Not really a "page" |

---

## STEP 6: State Management

### UserContext.tsx

Located at: `src/context/UserContext.tsx`

#### State Shape

```typescript
{
  user: {
    name: string,
    phone: string,
    createdAt: string | null
  },

  timeline: {
    currentPanel: number,      // 0=past, 1=present (but code mentions 2 panels only)
    profileComplete: boolean
  },

  situation: {                 // Level 1 answers
    experience: string,
    currentIncome: string,
    biggestChallenge: string,
    goal: string,
    longAnswer: string
  },

  level2: {                    // Level 2 answers
    pricingFeeling: string,
    raisedPrices: string,
    pricingStory: string
  },

  level3: {                    // Level 3 answers
    sellingFeeling: string,
    lostSale: string
  },

  progress: {
    currentScreen: string,     // "welcome" | "level" | "chatHome" | "timeline"
    currentLevel: number,      // 1, 2, 3
    currentStep: number,       // Step within level
    completedLevels: number[], // [1, 2, ...]
    videosWatched: string[],   // Video keys
    justCompletedLevel: boolean
  },

  memory: Array<{
    date: string,
    insight: string
  }>,

  conversation: Array<{
    role: "user" | "assistant",
    content: string,
    timestamp: string
  }>,

  lastVisit: string | null,
  firstVisit: string | null
}
```

#### Key Actions

| Action | What It Does |
|--------|--------------|
| `SET_SCREEN` | Changes currentScreen ("welcome", "level", "timeline") |
| `SET_ANSWER` | Saves user's answer (e.g., "situation.goal") |
| `ADVANCE_STEP` | Increments currentStep by 1 |
| `SET_STEP` | Sets currentStep to specific number |
| `COMPLETE_LEVEL` | Marks level complete, advances to next level |
| `START_LEVEL` | Sets screen to "level", resets currentStep to 0 |
| `WATCH_VIDEO` | Records video as watched |
| `ADD_MEMORY` | Adds insight to memory array |
| `ADD_MESSAGE` | Adds message to conversation |
| `SET_USER` | Updates user info (name, phone) |
| `SET_PANEL` | Changes timeline panel (0, 1, 2) |
| `SET_CURRENT_LEVEL` | Directly sets current level |
| `LOAD_STATE` | Restores state from localStorage |
| `RESET` | Resets to initial state |

#### Persistence

State is persisted to `localStorage` under key `mentorfy-rafael-ai-state`.

---

## STEP 7: Data Files

### levels.ts

Defines the structure of each level with steps:

```typescript
Level 1: "The Diagnosis"
- 4 multiple choice questions
- 1 contact info form
- 1 long answer question
- 1 AI moment (promptKey: "level-1-diagnosis")
- 1 video step
- 1 sales page (Whop checkout)

Level 2: "Premium Pricing"
- 2 multiple choice questions
- 1 long answer question
- 1 AI moment
- 1 video step
- 1 sales page (Calendly booking)

Level 3: "Sales Psychology"
- 1 multiple choice question
- 1 long answer question
- 2 AI moments
- 1 video step
```

### mentor.ts

Rafael's profile data and video library:

```typescript
{
  name: "Rafael Tats",
  handle: "@rafaeltats",
  avatar: "/rafael.jpg",
  welcome: { headline, videoUrl, buttonText, ... },
  videos: {
    "welcome-vsl": { url, title, context },
    "level-1-intro": { ... },
    "level-2-intro": { ... },
    // etc.
  }
}
```

### mockResponses.ts

AI response templates keyed by promptKey:

```typescript
{
  "level-1-diagnosis": (state) => "...",
  "level-2-diagnosis": (state) => "...",
  "chat": (state, userMessage) => "...",
  // etc.
}
```

---

## VOCABULARY

Translation between natural language and code:

| Natural Language | Code Name | File(s) |
|------------------|-----------|---------|
| "welcome screen" | `WelcomeScreen` | `screens/WelcomeScreen.tsx` |
| "landing page" | `WelcomeScreen` | `screens/WelcomeScreen.tsx` |
| "VSL video" | `VideoEmbed` + `mentor.welcome.videoUrl` | `shared/VideoEmbed.tsx`, `mentor.ts` |
| "level questions" | `LevelFlow` + `levels.ts` steps | `screens/LevelFlow.tsx`, `data/levels.ts` |
| "questionnaire" | `LevelFlow` | `screens/LevelFlow.tsx` |
| "AI moment" | `AIMomentView` + `mockResponses` | `screens/LevelFlow.tsx`, `mockResponses.ts` |
| "Rafael speaks" | `AIMomentView`, `StreamingMessage` | `screens/LevelFlow.tsx` |
| "chat bar" | `ChatInputBar` | `shared/ChatInputBar.tsx` |
| "message input" | `ChatInputBar` | `shared/ChatInputBar.tsx` |
| "journey view" | `PastView` | `screens/PastView.tsx` |
| "journey summary" | `PastView` | `screens/PastView.tsx` |
| "chat view" | `PresentView` | `screens/PresentView.tsx` |
| "timeline" | `ExperienceShell` | `layouts/ExperienceShell.tsx` |
| "3-panel view" | `ExperienceShell` with `Panel`s | `layouts/ExperienceShell.tsx` |
| "next level" | `FutureView` → `LevelFlow` | `screens/FutureView.tsx` |
| "checkout" | `SalesPage` (variant: default) | `screens/LevelFlow.tsx` |
| "booking" | `SalesPage` (variant: "calendly") | `screens/LevelFlow.tsx` |
| "header" | `LiquidGlassHeader` | `shared/LiquidGlassHeader.tsx` |
| "frosted glass" | `LiquidGlassHeader` style | `shared/LiquidGlassHeader.tsx` |
| "progress dots" | `ProgressIndicator` | `shared/ProgressIndicator.tsx` |
| "Rafael avatar" | `Avatar` | `shared/Avatar.tsx` |
| "verified badge" | `RafaelLabel` | `shared/RafaelLabel.tsx` |
| "thinking animation" | `ThinkingIndicator`, `ThinkingAnimation` | `screens/PresentView.tsx`, `shared/ThinkingAnimation.tsx` |
| "typewriter effect" | Multiple implementations | `PastView.tsx`, `PresentView.tsx`, `LevelFlow.tsx` |
| "user answers" | `state.situation`, `state.level2`, `state.level3` | `UserContext.tsx` |
| "user progress" | `state.progress` | `UserContext.tsx` |
| "current step" | `state.progress.currentStep` | `UserContext.tsx` |
| "current level" | `state.progress.currentLevel` | `UserContext.tsx` |
| "demo commands" | `DEMO_COMMANDS` object | `screens/PresentView.tsx` |
| "sell me" command | `DEMO_COMMANDS['sell me']` | `screens/PresentView.tsx` |
| "video command" | `DEMO_COMMANDS['video']` | `screens/PresentView.tsx` |
| "book me" command | `DEMO_COMMANDS['book me']` | `screens/PresentView.tsx` |
| "voice recording" | `VoiceRecordingBar`, `AudioWaveform` | `shared/ChatInputBar.tsx` |
| "watermark" | `MentorfyWatermark` | `shared/MentorfyWatermark.tsx` |
| "navigation arrow" | `NextArrow` | `shared/NextArrow.tsx` |

---

## Quick Reference: Where to Find Things

| If you want to change... | Look in... |
|--------------------------|------------|
| The welcome screen headline/video | `data/mentor.ts` → `welcome` object |
| Level questions | `data/levels.ts` → `steps` arrays |
| AI responses | `data/mockResponses.ts` |
| User state shape | `context/UserContext.tsx` |
| How levels flow | `screens/LevelFlow.tsx` |
| Chat behavior | `screens/PresentView.tsx` |
| Header design | `shared/LiquidGlassHeader.tsx` |
| Input bar design | `shared/ChatInputBar.tsx` |
| Video player | `shared/VideoEmbed.tsx` |
| Timeline navigation | `layouts/ExperienceShell.tsx` |
| Page routing | `app/rafael-ai/page.tsx` |
| Global styles | `app/globals.css` |
| Fonts | `app/layout.tsx` |

---

## Notes & Observations

1. **ActiveChat.tsx is dead code** - It's imported nowhere and appears to be from an earlier design iteration.

2. **ChatHome.tsx seems unused** - The state machine has a "chatHome" screen but it's never set to that value in the current flow.

3. **Lots of inline components** - LevelFlow.tsx and PresentView.tsx contain many sub-components that could be extracted.

4. **Mock AI only** - The `useAgent` hook uses mock responses. Real Claude integration exists in `lib/api.ts` but isn't connected.

5. **Timeline state confusion** - The comment says "0=past, 1=present (only 2 panels)" but there are actually 3 panels (0=past, 1=present, 2=future).

6. **Inconsistent styling** - Some components use Tailwind classes, others use inline styles. The inline styles are more common.

7. **No tests** - No test files found in the codebase.

8. **Hardcoded content** - Most content is hardcoded in the data files, not in a CMS.
