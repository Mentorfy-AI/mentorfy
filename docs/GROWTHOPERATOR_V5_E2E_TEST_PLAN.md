# Growth Operator V5 Flow - End-to-End Test Plan

**Purpose:** Systematic testing of the complete Growth Operator v5 assessment journey using Playwright MCP.

**Version:** 5.0 (17-question assessment + 8-screen AI diagnosis via Opus 4.5 with prompt caching)

**CRITICAL:** Abort on first failure. Do not continue past any failed assertion - the flow is sequential and later tests depend on earlier state.

---

## What Changed from V4

| Aspect | V4 | V5 |
|--------|----|----|
| Loading Screen Animation | Pulsing concentric rings | Spinning gradient ring (Gemini-style) |
| Loading Messages | 3 messages looping | 6 initial + 6 waiting loop + 1 ready message |
| Ready Indicator | None (auto-transition) | "Alright it's ready... let's dive in." |
| Progress Bar | Included loading step | Excludes loading + diagnosis steps |
| Header on Loading | Visible | Hidden |
| Prompt Caching | None | Anthropic ephemeral cache (~90% cost reduction) |
| Fade Transitions | None | Smooth fade-in on load, fade-out on transition |
| Error Handling | Basic | Specific messages for 400, 429, overload |

---

## Pre-Test Setup

### 1. Start Fresh Dev Server
```bash
bun dev
```
Wait for server to be ready on `localhost:3000`.

### 2. Verify Environment
Ensure `ANTHROPIC_API_KEY` is set (diagnosis uses Claude Opus 4.5).

### 3. Clear All State
Navigate to `localhost:3000/growthoperator` and execute in browser console:
```javascript
localStorage.clear();
sessionStorage.clear();
```
Refresh the page.

---

## Flow Overview

The v5 flow consists of:
- **17 Multiple-Choice Questions** (Q1-Q17)
- **1 Contact Gate** (name, email, phone)
- **1 Loading Screen** (spinning avatar animation with message cycling)
- **1 Diagnosis Sequence** (8 screens with internal navigation)
- **1 Disqualification Exit Point** (Q1 only)

**Total Steps:** 20 (17 Questions + Contact + Loading + Diagnosis)

**Visible Progress Steps:** 17 (loading and diagnosis excluded from count)

---

## Test Execution

### PHASE 0: Landing Page Verification

**Navigate to:** `http://localhost:3000/growthoperator`

**Assert the following elements exist with EXACT text:**

| Element | Expected Content |
|---------|------------------|
| Mentor Avatar | Brady Badour avatar image visible (88px) |
| Callout (italic, green accent) | `If online business still hasn't worked for you YET...` with "still hasn't" in green |
| Headline (green accents) | `It's not your fault. It's not the model. There's something you haven't been told.` with "not" and "haven't been told" in green |
| Subheadline | `Take this AI assessment to find out what's actually been in your way.` |
| Button | `Start Assessment` with arrow |
| Disclaimer (italic) | `Warning: This experience adapts based on your answers. Answer honestly... your diagnosis depends on it.` |

**Visual Verification:**
- Background color should be warm beige (#FAF6F0)
- Green accent color: #10B981
- Callout text should have "still hasn't" highlighted in green
- Headline should have "not" and "haven't been told" highlighted in green
- Staggered animation entrance (elements appear sequentially with 0.12s stagger)

**Action:** Click "Start Assessment" button.

---

### STEP 1: Q1 - Business Model Selection (Multiple Choice)

**Assert question text:** `What business model have you tried?`

**Assert instruction text:** `Select the model you've seriously attempted.`

**Assert ALL options present with EXACT labels:**
- `Ecommerce (dropshipping, Amazon FBA, print on demand)`
- `Agency or services (SMMA, lead gen, freelancing, AI automation)`
- `Sales (high ticket closing, appointment setting, remote sales)`
- `Content creation (YouTube, TikTok, podcast, newsletter)`
- `Coaching or courses (selling your own knowledge or expertise)`
- `Affiliate marketing (promoting other people's products)`
- `Software or apps (SaaS, no-code tools, browser extensions)`
- `Trading or investing (crypto, forex, stocks, real estate)`
- `I haven't seriously tried anything yet`

**Assert:** Back button IS visible (can return to landing page)

**Assert:** Question text is LEFT-ALIGNED (not centered)

**Action:** Select "Agency or services" option. (Clicking option auto-advances)

**EXIT CONDITION TEST:** If `I haven't seriously tried anything yet` is selected, assert DisqualificationScreen appears with:
- Headline: `This experience isn't for you yet.`
- Message containing: `This assessment is designed for people who've already taken real swings at building something online.`
- Message containing: `When you've tried something and felt it not work the way you expected, come back. We'll be here.`

---

### STEP 2: Q2 - Models Count (Multiple Choice)

**Assert question text:** `How many different business models have you actually committed to?`

**Assert ALL options present:**
- `Just 1 so far`
- `2 to 3 different things`
- `4 to 5 different things`
- `More than 5... I've tried a lot`

**Assert:** Back button IS visible

**Action:** Select "2 to 3 different things" option.

---

### STEP 3: Q3 - Original Motivation (Multiple Choice)

**Assert question text:** `Why did you get into online business in the first place?`

**Assert ALL options present:**
- `I wanted freedom and flexibility`
- `I wanted to make more money than a job would ever pay`
- `I wanted to build something that was actually mine`
- `I wanted to escape the 9-5 completely`
- `I wanted to prove to myself I could do it`
- `I saw other people living that life and wanted it too`

**Action:** Select "I wanted to escape the 9-5 completely" option.

---

### STEP 4: Q4 - Best Result (Multiple Choice)

**Assert question text:** `How far did you get with your BEST attempt?`

**Assert ALL options present:**
- `Never really got it off the ground`
- `Got started but never made real money`
- `Made some money but couldn't keep it going`
- `Made $1K to $5K months but plateaued or stopped`
- `Made $5K to $10K months but burned out`
- `Made $10K+ months but something still went wrong`

**Action:** Select "Made $1K to $5K months but plateaued or stopped" option.

---

### STEP 5: Q5 - What Happened (Multiple Choice)

**Assert question text:** `What actually happened?`

**Assert ALL options present:**
- `I couldn't get traction no matter what I tried`
- `I got some traction but couldn't figure out how to scale`
- `I was making money but working way too many hours`
- `The market got too competitive or saturated`
- `I ran out of money before it could take off`
- `Life circumstances forced me to stop`
- `I just lost motivation and couldn't keep pushing`
- `I'm not actually sure what went wrong`

**Action:** Select "I was making money but working way too many hours" option.

---

### STEP 6: Q6 - Duration (Multiple Choice)

**Assert question text:** `How long have you been trying to make online business work?`

**Assert ALL options present:**
- `Less than 6 months`
- `6 months to 1 year`
- `1 to 2 years`
- `2 to 3 years`
- `3 to 5 years`
- `More than 5 years`

**Action:** Select "2 to 3 years" option.

---

### STEP 7: Q7 - Money Invested (Multiple Choice)

**Assert question text:** `How much money have you invested in courses, coaching, and tools?`

**Assert ALL options present:**
- `Less than $500`
- `$500 to $2,000`
- `$2,000 to $5,000`
- `$5,000 to $10,000`
- `$10,000 to $25,000`
- `More than $25,000`

**Action:** Select "$5,000 to $10,000" option.

---

### STEP 8: Q8 - Deeper Cost (Multiple Choice)

**Assert question text:** `What has this cost you beyond money?`

**Assert ALL options present:**
- `Time I'll never get back`
- `Confidence in myself`
- `Relationships or strain with people close to me`
- `Other opportunities I passed up`
- `My peace of mind`
- `All of the above`

**Action:** Select "All of the above" option.

---

### STEP 9: Q9 - Education Source (Multiple Choice)

**Assert question text:** `Where did you learn most of what you know about online business?`

**Assert ALL options present:**
- `Free content (YouTube, podcasts, social media)`
- `A course I bought`
- `A coaching program or mastermind I joined`
- `A mix of courses and programs`
- `I mostly figured it out myself`

**Action:** Select "A mix of courses and programs" option.

---

### STEP 10: Q10 - Teacher Money Source (Multiple Choice)

**Assert question text:** `The people who taught you... how did THEY make most of their money?`

**Assert ALL options present:**
- `Teaching the thing... not doing it`
- `Actually doing the thing successfully`
- `Both teaching and doing`
- `I never really thought about it`
- `I taught myself, so this doesn't apply`

**Action:** Select "Teaching the thing... not doing it" option.

---

### STEP 11: Q11 - Belief About Failure (Multiple Choice)

**Assert question text:** `What do YOU think was the real reason it hasn't worked?`

**Assert ALL options present:**
- `I didn't execute well enough`
- `I didn't have enough time to fully commit`
- `I didn't have enough money to do it right`
- `The model I chose was too competitive`
- `I picked the wrong business model for me`
- `The information I got wasn't good enough`
- `I honestly don't know`

**Action:** Select "I picked the wrong business model for me" option.

---

### STEP 12: Q12 - Emotional State (Multiple Choice)

**Assert question text:** `How do you feel about "online business opportunities" at this point?`

**Assert ALL options present:**
- `Extremely skeptical... I've seen too much bullshit`
- `Frustrated... nothing has actually worked`
- `Cautiously open... maybe something real exists`
- `Exhausted but still not ready to quit`
- `Just want something that actually makes sense`

**Action:** Select "Cautiously open... maybe something real exists" option.

---

### STEP 13: Q13 - Shame (Multiple Choice)

**Assert question text:** `Be honest... has this journey made you feel embarrassed or ashamed?`

**Assert ALL options present:**
- `Yes... I've spent money and time with nothing to show for it`
- `Yes... I've told people I'm "working on something" for too long`
- `Yes... I feel like I should have figured this out by now`
- `A little... but I try not to think about it`
- `Not really... I see it all as part of the process`

**Action:** Select "Yes... I've spent money and time with nothing to show for it" option.

---

### STEP 14: Q14 - Why Keep Going (Multiple Choice)

**Assert question text:** `Despite everything... what's kept you going?`

**Assert ALL options present:**
- `I've seen others succeed... I know it's possible`
- `I refuse to go back to a "normal" path`
- `I don't have a backup plan... I need this to work`
- `I genuinely believe I'll figure it out eventually`
- `I can't explain it... I just can't let it go`

**Action:** Select "I refuse to go back to a \"normal\" path" option.

---

### STEP 15: Q15 - Vision (Multiple Choice)

**Assert question text:** `If this actually worked... what would change in your life first?`

**Assert ALL options present:**
- `I'd quit my job`
- `I'd stop stressing about money constantly`
- `I'd finally feel like I made it`
- `I'd have actual freedom to live how I want`
- `I'd be able to take care of the people I love`
- `Everything would change`

**Action:** Select "I'd quit my job" option.

---

### STEP 16: Q16 - Urgency (Multiple Choice)

**Assert question text:** `How urgent is this for you?`

**Assert ALL options present:**
- `I'm patient... I just want to find the right thing`
- `I'd like to see real progress in the next 6 months`
- `I need something to work this year`
- `It's urgent... I'm running low on time or money`
- `No specific timeline, but I'm ready to move now`

**Action:** Select "I need something to work this year" option.

---

### STEP 17: Q17 - Biggest Fear (Multiple Choice)

**Assert question text:** `What's your biggest fear about all of this?`

**Assert ALL options present:**
- `That I'll still be stuck in the same place a year from now`
- `That I'll waste more money on something that doesn't work`
- `That everyone else will figure it out except me`
- `That I'll eventually have to give up on this dream`
- `That maybe I'm just not cut out for this`

**Action:** Select "That I'll still be stuck in the same place a year from now" option.

---

### STEP 18: Contact Gate

**Assert question text:** `Enter your info to see your personalized diagnosis.`

**Assert:** Three input fields present:
- Name field with placeholder "Your name"
- Email field with placeholder "your@email.com"
- Phone field with placeholder "(555) 123-4567"

**Assert:** Back button is NOT visible (`noBackButton: true`)

**Assert:** Continue button is disabled until all fields are filled

**Action:** Fill in:
- Name: `Test User`
- Email: `test@example.com`
- Phone: `5551234567`

**Assert:** Continue button becomes enabled (green)

**Action:** Click "Continue" button.

---

### STEP 19: Loading Screen (V5 Updated)

**Assert:** Loading screen appears with smooth fade-in transition (0.8s duration)

**Assert:** Header and progress bar are NOT visible

**Assert:** Visual elements:
- Brady Badour avatar (100px) centered
- Spinning gradient ring animation around avatar (0.8s rotation, conic-gradient with accent color)
- Inner mask creating ring effect (108px circle)
- "Brady Badour" name with verified badge below avatar

**Assert:** Back button is NOT visible

**Assert initial messages cycle through (shown once each):**
1. `Analyzing your responses...`
2. `Identifying patterns in your journey...`
3. `This is interesting...`
4. `Connecting the dots...`
5. `I see what happened here...`
6. `Preparing your diagnosis...`

**Assert waiting loop messages cycle (if API takes longer):**
1. `Almost there...`
2. `Just a moment longer...`
3. `Putting the finishing touches...`
4. `This is taking a bit longer than usual...`
5. `Still working on it...`
6. `Hang tight...`

**Assert ready message appears when diagnosis completes:**
- `Alright it's ready... let's dive in.`

**Assert:** Messages display with:
- Italic font style (Lora serif)
- 20px font size
- Typing animation (30-50ms per character)
- 2.5-3.5 second pause between messages

**Assert:** Screen fades out (0.8s) before transitioning to diagnosis

**Wait:** Allow screen to auto-advance after diagnosis generation completes (10-30 seconds depending on API)

---

### STEP 20: Diagnosis Sequence (8 Screens)

The diagnosis sequence is a nested flow with its own navigation. Each screen should be tested individually.

**Progress Indicator:** The diagnosis uses a visual dot-based progress bar (not text). It shows 8 dots where completed steps are small green dots, the current step is an elongated black pill, and future steps are small gray dots.

#### Screen 1: The Mirror

**Assert:** Own header with Brady Badour avatar and name
**Assert:** Back button NOT visible on first screen
**Assert:** Visual progress indicator with 1st dot active (black pill), dots 2-8 gray
**Assert:** Typing animation on first visit (6-12ms per 3 chars)

**Assert content should include:**
- Reference to their specific business model (agency/services)
- Reference to their journey duration (2-3 years)
- Reference to money invested ($5K-$10K)
- Reference to what happened (working too many hours)
- Reference to their emotional state (cautiously open)
- Reference to their shame (spent money with nothing to show)
- Ends with: **"That's not weakness. That's signal."** or similar

**Assert:** Continue button appears after typing completes

**Action:** Click "Continue"

---

#### Screen 2: The Pattern

**Assert:** Back button IS visible
**Assert:** Progress indicator: dot 1 green, dot 2 active (black pill), dots 3-8 gray
**Assert:** If revisiting, content appears instantly (no typing animation)

**Assert content should:**
- Identify patterns across their answers
- Provide the "holy shit" insight moment
- Connect contradictions (e.g., tried multiple models, blames wrong model choice)

**Action:** Click "Continue"

---

#### Screen 3: The Paradigm Shift

**Assert:** Progress indicator: dots 1-2 green, dot 3 active, dots 4-8 gray

**Assert content should include:**
- The "shovel sellers" revelation
- Reference to their Q10 answer about teachers making money teaching
- "The dropshipping guru isn't making money dropshipping. They're selling dropshipping courses."
- The key insight: you don't need to BE an expert, partner with one

**Action:** Click "Continue"

---

#### Screen 4: The Absolution

**Assert:** Progress indicator: dots 1-3 green, dot 4 active, dots 5-8 gray

**Assert content should include:**
- **"You weren't failing."** (bold)
- Personalized absolution based on their model
- For agency: "You were succeeding at something that was never going to free you."
- Release from shame about money/time spent

**Action:** Click "Continue"

---

#### Screen 5: The Proof

**Assert:** Progress indicator: dots 1-4 green, dot 5 active, dots 6-8 gray

**Assert content should include:**
- Acknowledgment of skepticism
- Case studies with specific names and numbers:
  - **Kade** - was an artist, now **$30K/month** with AI YouTube creator
  - **Nick** - was a server, now **$50K/month** with woodworking creator
  - **Carson** - paid $7K for failed course, now **$100K/month** with tattoo creator
- "These are real people. You can DM them."

**Action:** Click "Continue"

---

#### Screen 6: The Reveal

**Assert:** Progress indicator: dots 1-5 green, dot 6 active, dots 7-8 gray

**Assert content should include:**
- **"It's called being a Growth Operator."** (bold)
- Simple 3-part explanation
- Personalized expert picture based on their background
- The math: 50K followers → 2% convert → $50K/month → 20% is yours = **$10K/month**
- Contrast lines relevant to their old pain (no more working too many hours, etc.)

**Action:** Click "Continue"

---

#### Screen 7: The Stakes

**Assert:** Progress indicator: dots 1-6 green, dot 7 active, dot 8 gray

**Assert content should include:**
- Callback to Q3 (original motivation - escape 9-5)
- Callback to Q6 (duration - 2-3 years)
- Callback to Q15 (vision - quit job)
- Callback to Q17 (fear - stuck in same place)
- Connection: "This is how [their vision] actually happens."

**Action:** Click "Continue"

---

#### Screen 8: The Close

**Assert:** Progress indicator: dots 1-7 green, dot 8 active
**Assert:** No "Continue" button on final screen

**Assert content should include:**
- **"You made it."** (bold) or similar closing
- Honor their journey using specific data
- Selection frame: **"You're exactly who we're looking for."**
- The ask: "Book a call. 30 minutes."
- Permission to say no

**CRITICAL ASSERT - Calendly Booking Widget:**
- **Assert:** Calendly booking widget appears inline after the main copy
- **Assert:** Widget URL contains: `https://calendly.com/brady-mentorfy/30min`
- **Assert:** Widget URL contains `session_id` parameter with valid session ID (e.g., `?session_id=abc123...`)
- **Assert:** Widget height is 700px
- **Assert:** Widget theme colors: backgroundColor FAF6F0, primaryColor 10B981

**Session Tracking Verification:**
To verify session_id is passed to Calendly:
1. Open browser DevTools → Network tab
2. Filter by "calendly"
3. Inspect the iframe src URL
4. Assert URL contains `session_id=` parameter with a non-empty value matching the current session

---

## Navigation Verification

### Back Button Behavior in Main Flow

| Step | Back Button State | Behavior |
|------|-------------------|----------|
| Q1 | **Rendered** | Returns to landing page |
| Q2-Q17 | **Rendered** | Returns to previous question |
| Contact Gate | **Not rendered** | Phase boundary (`noBackButton: true`) |
| Loading Screen | **Not rendered** | Cannot interrupt AI generation |
| Diagnosis | **Not rendered** | Nested flow handles own navigation |

### Header/Progress Visibility

| Step | Header Visible | Progress Bar Visible |
|------|----------------|---------------------|
| Q1-Q17 | Yes | Yes (shows X of 17) |
| Contact Gate | Yes | Yes (shows 17 of 17) |
| Loading Screen | **No** | **No** |
| Diagnosis | **No** (uses own) | **No** (uses own 8-dot visual indicator) |

### Back Button Behavior in Diagnosis Sequence

| Screen | Back Button State | Behavior |
|--------|-------------------|----------|
| Screen 1 | **Not visible** | First screen of sequence |
| Screens 2-8 | **Visible** | Returns to previous diagnosis screen |

**Back Button Test Cases:**

**TEST: Q1 back button returns to landing**
1. On Q1, assert back button IS visible
2. Click back button
3. Assert returns to landing page

**TEST: Mid-flow back navigation works**
1. Progress to Q5
2. Click back button
3. Assert returns to Q4 with previous answer preserved
4. Click back again
5. Assert returns to Q3 with previous answer preserved

**TEST: Contact gate has no back button**
1. Complete Q17, arrive at contact gate
2. Assert back button is NOT visible

**TEST: Loading screen hides header entirely**
1. Submit contact info, arrive at loading screen
2. Assert header is NOT visible
3. Assert progress bar is NOT visible

**TEST: Diagnosis sequence internal navigation**
1. Progress to diagnosis screen 3
2. Assert back button IS visible
3. Click back button
4. Assert returns to screen 2 with instant content (no typing animation)

---

## Error Handling Verification

### Loading Screen Errors

**TEST: Empty session data (400 error)**
1. Simulate empty session context
2. Assert error message: "Your session data is incomplete. Please restart the assessment."
3. Assert "Try Again" button appears

**TEST: Rate limit (429 error)**
1. Trigger rate limit
2. Assert error message: "Too many requests. Please wait a moment and try again."
3. Assert "Try Again" button appears

**TEST: API overload**
1. Simulate overloaded response
2. Assert error message: "Our AI is currently experiencing high demand. Please try again in a moment."

---

## Diagnosis Screen Content Verification

### Model-Specific Personalization

The AI diagnosis should adapt based on the user's answers. Verify these personalizations:

| Q1 Selection | Expected Expert Type in Screen 6 |
|--------------|----------------------------------|
| Agency/services | "agency consultant" or "marketing strategist" |
| Ecommerce | "ecommerce mentor" or "Shopify expert" |
| Content creation | "content coach" or "YouTube strategist" |
| Sales | "sales trainer" or "closer coach" |
| Coaching | "course creator" or "coaching consultant" |

### Absolution Lines (Screen 4)

| Q1 Selection | Expected Absolution |
|--------------|---------------------|
| Ecommerce | "You were playing a game designed to keep you searching." |
| Agency/services | "You were succeeding at something that was never going to free you." |
| Sales | "You were winning at a game with no finish line." |
| Content creation | "You were waiting for permission from an algorithm that doesn't care." |
| Coaching | "You had the product. You just didn't have the distribution." |
| Affiliate | "You were dependent by design." |
| Software | "You were outgunned from day one." |
| Investing | "You were gambling with better vocabulary." |

---

## Visual Style Verification

**Colors:**
- Background: #FAF6F0 (warm beige)
- Accent/Buttons: #10B981 (green)
- Button gradient: #12c48a to #0ea572 (for landing page)
- Text: #000/#111 (primary), #666/#888 (secondary)

**Typography:**
- Headlines: Lora, Charter, Georgia (serif)
- UI/Body: Geist, -apple-system, sans-serif
- Question text: 18px
- Diagnosis content: 17px with 1.75 line-height
- Loading messages: 20px italic

**Loading Screen Animations (V5):**
- Spinning gradient ring: 0.8s full rotation, linear easing
- Ring gradient: conic-gradient from transparent → accent → transparent (60deg arc)
- Ring size: 120px outer, 108px inner mask
- Avatar size: 100px
- Fade transitions: 0.8s ease-out

**Typing Animations:**
- Questions: 8-16ms per 2-char chunk
- Loading messages: 30-50ms per character (randomized)
- Diagnosis: 6-12ms per 3-char chunk (faster for longer content)

---

## Test Scenarios

### Scenario 1: Qualified Applicant (Happy Path)

Use test data through all 17 questions with valid answers (not the disqualification option).

**Expected Result:** Completes all 8 diagnosis screens with Calendly widget on final screen.

---

### Scenario 2: Disqualified - Never Tried (Q1)

**Q1 Selection:** `I haven't seriously tried anything yet`

**Expected Result:** DisqualificationScreen with:
- Headline: `This experience isn't for you yet.`
- Message: `This assessment is designed for people who've already taken real swings at building something online.`
- Message: `When you've tried something and felt it not work the way you expected, come back. We'll be here.`
- No further progression possible

---

## Disqualification Screen Verification

For each disqualification screen, verify:

1. **Layout:**
   - Mentor avatar (Brady) visible
   - Headline in large serif font (28px)
   - Message with proper line breaks
   - Mentorfy watermark at bottom

2. **No Escape:**
   - No back button visible
   - No continue button
   - No way to proceed (must refresh and restart)

---

## Prompt Caching Verification (V5 New)

**Assert in Langfuse traces:**
- First request: `cacheCreationInputTokens > 0` (cache miss, creating cache)
- Subsequent requests (within 5 min): `cacheReadInputTokens > 0` (cache hit)

**Expected cache behavior:**
- System prompt (~8KB) cached for 5 minutes
- ~90% reduction in input token costs on cache hits
- Faster time-to-first-token on cached requests

---

## Issue Reporting Format

When an assertion fails, report using this format:

```
## FAILED: [Step X or Screen Y]

**Expected:** [What should have happened]
**Actual:** [What actually happened]
**Screenshot:** [If applicable]
**Console Errors:** [Any JS errors]
```

---

## Summary of Key Checkpoints

| Checkpoint | Step | Expected Behavior |
|------------|------|-------------------|
| Landing Page | 0 | Green-accented callout/headline, "Start Assessment" button |
| Q1 Exit Condition | 1 | "Haven't tried" → Disqualification |
| Q1 Back Button | 1 | Visible, returns to landing |
| Contact Gate | 18 | Name/email/phone required, no back button |
| Loading Screen | 19 | Spinning ring, 6+6+1 messages, header hidden, fade transitions |
| Ready Message | 19 | "Alright it's ready... let's dive in." when API returns |
| Diagnosis Screen 1 | 20.1 | Mirrors user's specific journey, typing animation |
| Diagnosis Screen 4 | 20.4 | Model-specific absolution line |
| Diagnosis Screen 5 | 20.5 | Kade/Nick/Carson case studies with $ numbers |
| Diagnosis Screen 6 | 20.6 | "Growth Operator" reveal + math |
| Diagnosis Screen 8 | 20.8 | Calendly widget inline after copy |

---

## Markdown Rendering Verification

**For all diagnosis screens, verify:**

1. **Bold text** renders as visually bold (no asterisks visible)
2. Numbered lists render properly (1. 2. 3.)
3. Clear paragraph separation with breathing room
4. Short paragraphs (1-2 sentences each)

**FAIL examples:**
```
**Bold text** not rendered        <- asterisks visible
1. List item not rendered         <- raw markdown visible
```

**PASS examples:**
- **Bold** appears visually bold
- Numbered lists are properly formatted
- Paragraphs have clear visual separation

---

## Architecture Note: Component Hierarchy

```
PhaseFlow (parent)
├── GlassHeader (hidden for loading/diagnosis)
├── StepProgress (hidden for loading/diagnosis)
├── MultipleChoiceStepContent (Q1-Q17)
├── ContactInfoStepContent (Contact Gate)
├── LoadingScreenStepContent (Loading - manages own UI)
│   ├── MentorAvatar with spinning ring
│   ├── MentorBadge
│   └── Message cycling with typing animation
└── DiagnosisSequenceFlow (Diagnosis - manages own navigation)
    ├── Own GlassHeader
    ├── Own StepProgress (1-8)
    └── 8 markdown-rendered screens
```

The parent `PhaseFlow` component explicitly hides its own header and progress bar when the `loading` or `diagnosis-sequence` step types are active.

See:
- `src/components/flow/screens/LoadingScreenStepContent.tsx` for loading implementation
- `src/components/flow/screens/DiagnosisSequenceFlow.tsx` for diagnosis implementation
- `src/components/flow/screens/PhaseFlow.tsx` for navigation logic
