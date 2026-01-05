# Mentorfy App - Complete Interaction Inventory

Generated: 2026-01-05

## Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Redirects to `/rafael-ai` | Working |
| `/rafael-ai` | Main app (landing + quiz + chat) | Working |

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/session` | Create/manage user sessions |
| `/api/session/[id]` | Get/update specific session |
| `/api/session/[id]/link` | Session linking |
| `/api/chat` | AI chat messages (with tool support) |
| `/api/generate/[type]` | Generate content (diagnosis, etc) |
| `/api/transcribe` | Voice-to-text |
| `/api/upload` | File uploads |

---

## Phase 1: The Diagnosis

### Question 1: Business Stage

| Element | Interaction | Status |
|---------|-------------|--------|
| 5 multiple choice buttons | Click -> Next question | Working |

Options:
- Fully booked out 3+ months
- Booked out 1-2 months
- Booked out about 1 month
- Booked out 1-2 weeks
- Bookings are inconsistent

### Question 2: Day Rate

| Element | Interaction | Status |
|---------|-------------|--------|
| 6 multiple choice buttons | Click -> Next question | Working |

Options:
- $4k+
- $3k - $4k
- $2k - $3k
- $1k - $2k
- $500 - $1k
- Under $500

### Question 3: Blocker

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- Posting but results are unpredictable
- DMs are all price shoppers
- No time — tattooing all day
- Good work but invisible

### Question 4: Contact Form

| Element | Interaction | Status |
|---------|-------------|--------|
| Name textbox | Type input | Working |
| Email textbox | Type input | Working |
| Phone textbox | Type input | Working |
| Continue button (disabled until filled) | Click -> Next | Working |

### Question 5: Open-ended (Confession)

| Element | Interaction | Status |
|---------|-------------|--------|
| Free text textarea ("No wrong answer...") | Type input | Working |
| Continue button | Click -> Trigger AI diagnosis | Working |

### Phase 1 AI Moment

| Element | Interaction | Status |
|---------|-------------|--------|
| Streaming AI diagnosis | Auto-generates personalized content | Working |
| Markdown rendering | Headers, lists, bold, emojis | Working |
| Continue button | Click -> Phase 2 (triggers auth modal) | Working |

AI Diagnosis Sections:
- Current Position analysis
- Key Blockers identified
- Quick Wins (This Week)
- Growth Path guidance
- Real Talk summary

---

## Phase 2: Get Booked Without Going Viral

### Question 1: Check First After Posting

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- Views and likes
- Follower count
- Comments and DMs
- Saves and shares

### Question 2: 100k Followers

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- Finally be consistently booked
- Charge more
- Probably not much
- Feel like I made it

### Question 3: Post Success

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- Gets over 10k views
- Gets lots of comments
- Someone DMs about booking
- Nothing feels consistent

### Question 4: Open-ended (Views Reflection)

| Element | Interaction | Status |
|---------|-------------|--------|
| Free text textarea ("Think about it...") | Type input | Working |
| Continue button | Click -> Trigger AI moment | Working |

### Phase 2 AI Moment

| Element | Interaction | Status |
|---------|-------------|--------|
| Streaming AI response | Auto-generates content | Working |
| Continue button | Click -> Phase 3 | Working |

---

## Phase 3: The 30-Minute Content System

### Question 1: Time on Content

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- Almost none
- 1-2 hours
- 3-5 hours
- 5+ hours

### Question 2: Hardest Part

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- Don't know what to post
- No time
- Awkward on camera
- Nothing converts

### Question 3: Content Creator Identity

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- No, I'm an artist
- Kind of
- Yeah, part of the game
- Never thought about it

### Question 4: Open-ended (Extra Time)

| Element | Interaction | Status |
|---------|-------------|--------|
| Free text textarea ("Be specific...") | Type input | Working |
| Continue button | Click -> Trigger AI moment | Working |

### Phase 3 AI Moment

| Element | Interaction | Status |
|---------|-------------|--------|
| Streaming AI response | Auto-generates content | Working |
| Continue button | Click -> Phase 4 | Working |

---

## Phase 4: Double Your Revenue

### Question 1: Last Price Raise

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- Within 3 months
- 6 months ago
- Over a year
- Never

### Question 2: "Too Expensive" Response

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- Offer a discount
- Explain why I'm worth it
- Let them walk
- Panic and give in

### Question 3: Pricing Fear

| Element | Interaction | Status |
|---------|-------------|--------|
| 4 multiple choice buttons | Click -> Next question | Working |

Options:
- Lose clients
- Look greedy
- Not worth more yet
- No fear, just don't know how

### Question 4: Open-ended (Double Revenue)

| Element | Interaction | Status |
|---------|-------------|--------|
| Free text textarea ("Dream big...") | Type input | Working |
| Continue button | Click -> Trigger AI moment | Working |

### Phase 4 AI Moment

| Element | Interaction | Status |
|---------|-------------|--------|
| Streaming AI response | Auto-generates content | Working |
| Continue button | Click -> Sales page | Working |

---

## Sales Page (After Phase 4)

| Element | Interaction | Status |
|---------|-------------|--------|
| Headline "You're a great fit for 1-on-1" | Display only | Working |
| Copy sections (how it works, no pressure) | Display only | Working |
| Calendly iframe embed | Interactive booking widget | Working |
| "Continue without purchasing" option | Display only | Working |
| Continue button | Click -> Should enter chat | **BUG** |

---

## Authentication (Clerk)

| Component | Trigger | Status |
|-----------|---------|--------|
| Sign-in modal | After Phase 1 complete | Working |
| Sign-in modal | After Phase 2 complete | Working |
| Sign-in modal | After Phase 3 complete | Working |
| Sign-in modal | After Phase 4 complete | Working |
| Close modal button | Click -> Dismiss modal | Working |
| Email input | Type email | Working |
| "Use phone" link | Switch to phone auth | Visible |
| Continue button | Submit auth | Visible |
| Sign up link | Navigate to sign up | Visible |
| Development mode indicator | Display only | Working |

---

## Chat Interface (Tool-Based Embeds)

### Backend Changes (New)

| Component | Purpose | Status |
|-----------|---------|--------|
| Dynamic tool generation | Tools created based on completed phases | Implemented |
| `showCheckout` tool | Display checkout embed | Implemented |
| `showVideo` tool | Display video embed | Implemented |
| `showBooking` tool | Display Calendly embed | Implemented |
| Server-side URL resolution | URLs resolved from phase data | Implemented |

### Frontend Changes (New)

| Component | Purpose | Status |
|-----------|---------|--------|
| `useChat` hook (AI SDK v6) | Chat communication | Implemented |
| Tool invocation rendering | Display embeds from tools | Implemented |
| `getMessageText()` helper | Extract text from message parts | Implemented |
| `getEmbedFromMessage()` helper | Extract embed data from tool results | Implemented |

---

## Known Issues / Bugs

| Issue | Description | Priority |
|-------|-------------|----------|
| "Level not found" after Phase 4 | After completing all phases and sales page, clicking Continue shows "Level not found" | High |
| Auth modal on every phase | Sign-in modal appears at start of each phase (can be dismissed) | Medium |
| Session sync errors in console | "Failed to validate session" / "Sync error" on initial load | Low |

---

## Embed Types Available

| Embed Type | Source | Trigger |
|------------|--------|---------|
| Checkout (Whop) | `checkoutPlanId` from sales-page step | AI tool call |
| Video (Wistia) | `videoUrl` from video step | AI tool call |
| Booking (Calendly) | `calendlyUrl` from sales-page step | AI tool call + Phase 4 sales page |

---

## Technical Notes

- App uses Next.js 15 App Router with React 19
- Clerk configured for auth (modal-based sign-in)
- AI SDK v6 with tool support for embeds
- Wistia for video embeds
- Whop for checkout embeds
- Calendly for booking embeds
- Framer Motion for animations
- AI responses stream in real-time via `toUIMessageStreamResponse()`
- Session management via Supabase
- Supermemory for conversation context

---

## Test Environment

- Tested using Playwright MCP
- Ubuntu server
- Dev server at localhost:3000
- Bun package manager
