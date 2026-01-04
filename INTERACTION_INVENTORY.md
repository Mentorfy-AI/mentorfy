# Mentorfy App - Complete Interaction Inventory

Generated: 2026-01-03

## Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Redirects to `/rafael-ai` | Working |
| `/rafael-ai` | Main app (landing + chat) | Working |

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/session` | Create/manage user sessions |
| `/api/session/[id]` | Get/update specific session |
| `/api/session/[id]/link` | Session linking |
| `/api/chat` | AI chat messages |
| `/api/generate/[type]` | Generate content (diagnosis, etc) |
| `/api/transcribe` | Voice-to-text |
| `/api/upload` | File uploads |

---

## View 1: Landing Page (`/rafael-ai`)

| Element | Interaction | Status |
|---------|-------------|--------|
| Mentor avatar + name | Display only | Working |
| Verification badge | Display only | Working |
| Headline/subheadline | Display only | Working |
| Video thumbnail | Click -> Opens Wistia embed | Working |
| "Show Me How" button | Click -> Starts quiz funnel | Working |
| Trust indicator (stars) | Display only | Working |
| "Mentorfy AI Experience" footer | Display only | Working |

---

## View 2: Quiz Funnel (Multi-step)

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
- No time - tattooing all day
- Good work but invisible

### Question 4: Contact Form

| Element | Interaction | Status |
|---------|-------------|--------|
| Name textbox | Type input | Working |
| Email textbox | Type input | Working |
| Phone textbox | Type input | Working |
| Continue button (disabled until filled) | Click -> Next | Working |

### Question 5: Open-ended

| Element | Interaction | Status |
|---------|-------------|--------|
| Free text textarea | Type input | Working |
| Continue button | Click -> Generate diagnosis | Working |

---

## View 3: AI Diagnosis Screen

| Element | Interaction | Status |
|---------|-------------|--------|
| Streaming AI response | Auto-generates personalized content | Working |
| Markdown rendering | Displays headers, lists, bold, emojis | Working |
| Continue button | Click -> Enter chat | Working |

### Diagnosis Content Sections
- Current Position analysis
- Key Blockers identified
- Quick Wins (This Week) recommendations
- Growth Path guidance
- Bottom Line summary

---

## View 4: Main Chat Interface

### Header

| Element | Interaction | Status |
|---------|-------------|--------|
| Back button | Click -> Goes to previous step | Working |
| Mentor avatar/name | Display only | Working |
| Menu button | Click -> No visible effect | NOT IMPLEMENTED |

### Chat Content

| Element | Interaction | Status |
|---------|-------------|--------|
| Phase summary card | Display only | Working |
| Phase roadmap list | Display only | Working |
| Continue to Phase X button | Click -> Advances phase | Working |

### Input Area

| Element | Interaction | Status |
|---------|-------------|--------|
| Text input ("Message Rafael...") | Type free-form message | Code exists |
| Voice record button | Click -> Record audio | Code exists |
| Audio waveform visualizer | Displays during recording | Code exists |
| File upload button | Click -> Upload files | API exists |

### Quick Reply System

| Element | Interaction | Status |
|---------|-------------|--------|
| Multiple choice buttons | Click -> Sends answer, shows next question | Working |
| Open-ended text inputs | Type -> Continue | Working |

### Sample Quick Reply Questions Observed
- "What do you check first after posting?" (4 options)
- "If you had 100k followers, what would change?" (4 options)
- "When does a post feel like it worked?" (4 options)
- "What would change if views didn't matter?" (open-ended)

---

## Authentication

| Component | Status |
|-----------|--------|
| ClerkProvider | Configured in layout.tsx |
| Sign-in page | NOT IMPLEMENTED |
| Sign-up page | NOT IMPLEMENTED |
| Protected routes | NOT IMPLEMENTED |
| User profile | NOT IMPLEMENTED |

---

## Missing/Incomplete Features

| Feature | Current State | Priority | Notes |
|---------|---------------|----------|-------|
| Menu/sidebar | Button exists, no action | High | Need settings/navigation |
| Auth/Sign-in | ClerkProvider only | High | No protected routes or sign-in UI |
| User profile | Not visible | Medium | Account management needed |
| Session persistence | API exists | Medium | Test if sessions restore on refresh |
| Phase 2-4 content | Partially explored | Medium | Need to complete full flow |
| Offer/checkout | Unknown | High | "After Phase 4" - not explored |
| Voice input testing | Code exists | Low | Works but untested in headless |
| File upload testing | API exists | Low | Not tested via UI |

---

## Technical Notes

- App uses Next.js App Router with React 19
- Clerk configured for auth (not yet implemented)
- Wistia for video embeds
- Framer Motion for animations
- AI responses stream in real-time
- Session management via API routes
- Voice transcription endpoint available

---

## Test Environment

- Tested using Playwright MCP in headless mode
- Ubuntu server without GUI
- Dev server at localhost:3000
