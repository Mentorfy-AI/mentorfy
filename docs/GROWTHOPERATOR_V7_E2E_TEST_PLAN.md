# Growth Operator V7 Flow - End-to-End Test Plan

**Purpose:** Systematic testing of the complete Growth Operator v7 assessment journey using Playwright MCP.

**Version:** 7.0 (18-question assessment with 4 AI moments + 6-screen AI diagnosis via Opus 4.5)

**CRITICAL:** Abort on first failure. Do not continue past any failed assertion - the flow is sequential and later tests depend on earlier state.

---

## What Changed from V6

| Aspect | V6 | V7 |
|--------|----|----|
| Diagnosis Screens | 8 screens for all users | **6 screens** for ICP 1-3, **5 screens** for ICP 4 |
| Screen 5 | Proof/case studies | **The Invitation** - 10 elements with agreement question |
| Screen 6 | The Reveal | **The Call** - CTA with Calendly (ICP 1-3 only) |
| Confession Usage | Referenced in some screens | **Echoes through ALL 6 screens** |
| Page Load Animation | None | **Smooth fade-in** (0.4s) on initial mount |
| Question Transitions | Slide animations | **Clean fade-out** (opacity only, no sliding) |
| Back Button | Standard styling | **GlassBackButton** with glassmorphic styling |
| Continue Button | Flat green button | **Circular glass button** with pulsing green glow |
| AI Moment Continue | Below text | **Inline at bottom-right** of text container |
| Markdown Renderer | react-markdown | **ClientMarkdown** (Turbopack-compatible) |
| Horizontal Rules | Not supported | **Gradient fade styling** for `---` |

---

## Pre-Test Setup

### 1. Start Fresh Dev Server
```bash
bun dev
```
Wait for server to be ready on `localhost:3000`.

### 2. Verify Environment
Ensure `ANTHROPIC_API_KEY` and `GOOGLE_AI_API_KEY` are set (diagnosis uses Claude Opus 4.5, AI moments use Gemini Flash).

### 3. Clear All State
Navigate to `localhost:3000/growthoperator` and execute in browser console:
```javascript
localStorage.clear();
sessionStorage.clear();
```
Refresh the page.

---

## Flow Overview

The v7 flow consists of:
- **5 Sections** with labeled progress indicators
- **18 Questions** (Q1-Q18) across sections
- **4 AI Moments** (personalized reflection screens between sections)
- **1 Contact Gate** (name, email, phone)
- **1 Loading Screen** (spinning avatar animation with message cycling)
- **1 Diagnosis Sequence** (6 screens for ICP 1-3, 5 screens for ICP 4)

**Section Breakdown:**
| Section | Label | Questions | AI Moment |
|---------|-------|-----------|-----------|
| 1 | "Your Situation" | Q1-Q5 | AI Moment 1 |
| 2 | "Your Journey" | Q6-Q9 | AI Moment 2 |
| 3 | "Going Deeper" | Q10-Q13 | AI Moment 3 |
| 4 | "The Confession" | Q14 | AI Moment 4 |
| 5 | "What's At Stake" | Q15-Q18 | (none) |

**Total Steps:** 28 (18 Questions + 4 AI Moments + Contact + Loading + Diagnosis)

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
- Staggered animation entrance (elements appear sequentially with 0.12s stagger)

**Action:** Click "Start Assessment" button.

---

## UI Animation Verification (V7 New)

### Initial Page Load Animation

**Assert:** When first question loads, content fades in smoothly
- Opacity transitions from 0 to 1
- Duration: 0.4s
- Easing: ease-out
- No sliding/horizontal movement

### Question Transition Animation

**Assert:** When advancing to next question:
- Current content fades out (opacity only)
- New content fades in (opacity only)
- Duration: 0.3s fade-out, 0.3s fade-in
- No sliding/horizontal movement between questions

### Back Button Styling (GlassBackButton)

**Assert:** Back button has glassmorphic styling:
- Semi-transparent background with blur effect
- Gradient border (subtle light gradient)
- Layered shadows for depth
- Matches header pill aesthetic

### Continue Button Styling (Glass Circle)

**Assert:** Continue button is a circular glass button:
- Circular shape (not rectangular)
- Glassmorphic styling (blur, transparency)
- Pulsing green glow animation (#10B981)
- Glow pulses continuously while visible

### AI Moment Continue Position

**Assert:** On AI moment screens, continue button is:
- Positioned inline at bottom-right of text container
- NOT floating at bottom of screen
- Appears after typing animation completes

---

## SECTION 1: YOUR SITUATION (Q1-Q5)

### STEP 1: Q1 - Why Are You Here (Multiple Choice)

**Assert:** Progress label shows `YOUR SITUATION`
**Assert:** Progress indicator shows 5 dots (dot 1 active)

**Assert question text:** `Why are you here?`

**Assert ALL options present with EXACT labels:**
- `I'm still trying to figure this online business thing out`
- `I've tried things that didn't work and I'm looking for what will`
- `I'm stuck and I need a new direction`
- `Something told me to click... so here I am`

**Assert:** Back button IS visible (GlassBackButton style)
**Assert:** Question text is LEFT-ALIGNED (not centered)

**Action:** Select "I've tried things that didn't work and I'm looking for what will" option.

---

### STEP 2: Q2 - Desired Income (Multiple Choice)

**Assert:** Progress indicator: dot 1 green, dot 2 active, dots 3-5 gray

**Assert question text:** `If this actually worked... what would you want to be making?`

**Assert ALL options present:**
- `$5,000/month — enough to breathe`
- `$10,000/month — real freedom starts here`
- `$25,000/month — life changing money`
- `$50,000/month — a completely different life`
- `$100,000+/month — the big dream`

**Action:** Select "$25,000/month — life changing money" option.

---

### STEP 3: Q3 - Current Income (Multiple Choice)

**Assert:** Progress indicator: dots 1-2 green, dot 3 active, dots 4-5 gray

**Assert question text:** `What are you actually making right now?`

**Assert ALL options present:**
- `Less than $1,000/month`
- `$1,000 - $3,000/month`
- `$3,000 - $5,000/month`
- `$5,000 - $10,000/month`
- `Over $10,000/month`

**Action:** Select "$5,000 - $10,000/month" option.

---

### STEP 4: Q4 - Models Tried (Multiple Choice)

**Assert:** Progress indicator: dots 1-3 green, dot 4 active, dot 5 gray

**Assert question text:** `What have you actually tried?`

**Assert ALL options present:**
- `Ecommerce — dropshipping, Amazon, print on demand`
- `Agency or services — SMMA, freelancing, lead gen, AI automation`
- `Sales — closing, setting, remote sales roles`
- `Content — YouTube, TikTok, podcasts, newsletters`
- `Coaching or courses — selling what you know`
- `Affiliate — promoting other people's stuff`
- `Software — SaaS, apps, no-code tools`
- `Trading or investing — crypto, forex, stocks`
- `I haven't really tried anything seriously yet`

**Note:** Selecting "I haven't really tried anything seriously yet" does NOT trigger disqualification. All users continue.

**Action:** Select "Agency or services — SMMA, freelancing, lead gen, AI automation" option.

---

### STEP 5: Q5 - Models Count (Multiple Choice)

**Assert:** Progress indicator: dots 1-4 green, dot 5 active

**Assert question text:** `How many different things have you actually gone all-in on?`

**Assert ALL options present:**
- `Just one thing so far`
- `2-3 different models`
- `4-5 different models`
- `More than 5... I've been searching for a while`

**Action:** Select "2-3 different models" option.

---

### STEP 6: AI Moment 1 - Recognition + Gap Validation

**Assert:** Progress bar is HIDDEN (AI moments don't show section progress)
**Assert:** Back button is NOT visible (`noBackButton: true`)

**Assert:** AI-generated content appears with typing animation
**Assert:** Content references user's answers from Q1-Q5:
- Reference to why they're here (Q1)
- Reference to desired income (Q2) and current income (Q3) gap
- Reference to what they've tried (Q4)
- Reference to how many things they've tried (Q5)

**Assert:** Continue button appears inline at bottom-right after typing completes (circular glass style with green glow)

**Action:** Click Continue button.

---

## SECTION 2: YOUR JOURNEY (Q6-Q9)

### STEP 7: Q6 - Duration (Multiple Choice)

**Assert:** Progress label shows `YOUR JOURNEY`
**Assert:** Progress indicator shows 4 dots (dot 1 active)

**Assert question text:** `How long have you been trying to make this work?`

**Assert ALL options present:**
- `Less than 6 months`
- `6 months to a year`
- `1-2 years`
- `2-3 years`
- `3-5 years`
- `More than 5 years`

**Action:** Select "3-5 years" option.

---

### STEP 8: Q7 - Total Investment (Multiple Choice)

**Assert question text:** `When you add it all up — courses, coaching, tools, ads, everything — how much have you put on the line?`

**Assert ALL options present:**
- `Less than $500`
- `$500 - $2,000`
- `$2,000 - $5,000`
- `$5,000 - $10,000`
- `$10,000 - $25,000`
- `More than $25,000`

**Action:** Select "$10,000 - $25,000" option.

---

### STEP 9: Q8 - Available Capital (Multiple Choice - PERSONALIZED)

**Assert:** Question may be personalized based on previous answers
**Assert:** Typing animation plays if personalized

**Assert question contains:** `How much do you actually have available right now to put toward finally making this work?`

**Assert ALL options present:**
- `Less than $1,000`
- `$1,000 - $3,000`
- `$3,000 - $5,000`
- `$5,000 - $10,000`
- `More than $10,000`

**Action:** Select "$5,000 - $10,000" option.

---

### STEP 10: Q9 - Deeper Cost (Multiple Choice)

**Assert question text:** `What has this cost you beyond money?`

**Assert ALL options present:**
- `Time I'm never getting back`
- `Confidence in myself`
- `Relationships — strain with people who matter`
- `Other opportunities I let pass`
- `My peace of mind`
- `All of the above`

**Action:** Select "All of the above" option.

---

### STEP 11: AI Moment 2 - Validation + Pattern Tease

**Assert:** Progress bar HIDDEN
**Assert:** Back button NOT visible

**Assert:** AI-generated content references:
- Duration of journey (Q6)
- Total investment (Q7)
- Available capital (Q8)
- Deeper costs (Q9)

**Assert:** Continue button inline at bottom-right (circular glass with green glow)

**Action:** Click Continue button.

---

## SECTION 3: GOING DEEPER (Q10-Q13)

### STEP 12: Q10 - Position in Equation (Multiple Choice)

**Assert:** Progress label shows `GOING DEEPER`
**Assert:** Progress indicator shows 4 dots (dot 1 active)

**Assert question text:** `In the things you've tried... where were YOU in the equation?`

**Assert ALL options present:**
- `I was trying to be the expert — the one with the knowledge and credibility`
- `I was trying to be the marketer — getting attention, building an audience`
- `I was doing everything myself — expert, marketer, operator, all of it`
- `I was working in someone else's system — their business, their rules`
- `I never really thought about where I was positioned`

**Action:** Select "I was doing everything myself — expert, marketer, operator, all of it" option.

---

### STEP 13: Q11 - Teacher Money (Multiple Choice)

**Assert question text:** `The people who taught you this stuff... how did THEY make most of their money?`

**Assert ALL options present:**
- `Teaching it — courses, coaching, content about the thing`
- `Actually doing it — making money from the business model itself`
- `Both — doing it AND teaching it`
- `I never really thought about it`
- `I mostly taught myself`

**Action:** Select "Teaching it — courses, coaching, content about the thing" option.

---

### STEP 14: Q12 - AI Relationship (Multiple Choice)

**Assert question text:** `How has AI changed how you think about all of this?`

**Assert ALL options present:**
- `Everything feels more uncertain now`
- `I see opportunity but I don't know how to capture it`
- `I'm worried about being left behind`
- `I think it's mostly hype — things haven't really changed`
- `I'm trying to figure out where I fit in the new landscape`

**Action:** Select "I see opportunity but I don't know how to capture it" option.

---

### STEP 15: Q13 - Thought Constellation (MULTI-SELECT)

**Assert question text:** `Which of these thoughts have actually crossed your mind?`
**Assert instruction text:** `Select all that apply`

**Assert ALL options present:**
- `"Maybe I'm just not smart enough for this"`
- `"I've wasted so much time"`
- `"Everyone else seems to figure it out except me"`
- `"What if I'm still in the same place in 5 years?"`
- `"I should have just gotten a normal job"`
- `"I can't give up now — I've already put too much in"`
- `"There has to be something I'm missing"`
- `"The game feels rigged"`

**Assert:** Multiple options can be selected (checkboxes, not radio buttons)
**Assert:** Continue button appears after at least one selection

**Action:** Select: "Everyone else seems to figure it out except me", "I can't give up now — I've already put too much in", "There has to be something I'm missing"

**Action:** Click Continue button.

---

### STEP 16: AI Moment 3 - Insight Delivery + Pre-Frame

**Assert:** Progress bar HIDDEN
**Assert:** Back button NOT visible

**Assert:** AI-generated content references:
- Position in equation (Q10)
- Teacher money source (Q11)
- AI relationship (Q12)
- Selected thoughts from constellation (Q13)

**Assert:** Continue button inline at bottom-right (circular glass with green glow)

**Action:** Click Continue button.

---

## SECTION 4: THE CONFESSION (Q14)

### STEP 17: Q14 - The Confession (OPEN-ENDED)

**Assert:** Progress label shows `THE CONFESSION`
**Assert:** Progress indicator shows 1 dot (active)
**Assert:** Back button NOT visible (`noBackButton: true`)

**Assert question text:** `In one sentence... what's the most frustrating part of this whole journey that you don't really talk about?`

**Assert:** Text input field present (not multiple choice)
**Assert:** Placeholder text: `Type your answer here...`
**Assert:** Continue button disabled until text is entered

**Action:** Type: `I'm exhausted from trying to figure this out alone and I'm starting to wonder if I'm just not cut out for this.`

**Assert:** Continue button becomes enabled (circular glass with green glow)

**Action:** Click Continue button.

---

### STEP 18: AI Moment 4 - Acknowledgment + Bridge

**Assert:** Progress bar HIDDEN
**Assert:** Back button NOT visible

**Assert:** AI-generated content:
- Directly acknowledges their confession
- Validates the feeling without dismissing it
- Creates bridge to final section

**Assert:** Continue button inline at bottom-right (circular glass with green glow)

**Action:** Click Continue button.

---

## SECTION 5: WHAT'S AT STAKE (Q15-Q18)

### STEP 19: Q15 - What's Kept You Going (Multiple Choice)

**Assert:** Progress label shows `WHAT'S AT STAKE`
**Assert:** Progress indicator shows 4 dots (dot 1 active)

**Assert question text:** `Despite everything... what's kept you going?`

**Assert ALL options present:**
- `I've seen other people make it work — I know it's possible`
- `I refuse to go back to "normal" — that's not an option for me`
- `I don't have a backup plan — I need this to work`
- `I still believe I'll figure it out eventually`
- `I can't explain it — something in me just won't let go`

**Action:** Select "I refuse to go back to \"normal\" — that's not an option for me" option.

---

### STEP 20: Q16 - What Would Change (Multiple Choice)

**Assert question text:** `If this actually worked... what would change first?`

**Assert ALL options present:**
- `I'd quit my job`
- `I'd stop stressing about money all the time`
- `I'd finally feel like I actually made it`
- `I'd have real freedom — my time would be mine`
- `I'd be able to take care of the people I love`
- `Honestly? Everything would change`

**Action:** Select "I'd have real freedom — my time would be mine" option.

---

### STEP 21: Q17 - Urgency (Multiple Choice)

**Assert question text:** `How urgent is this for you?`

**Assert ALL options present:**
- `I'm patient — I just want to find the right thing`
- `I want real progress in the next 6 months`
- `I need something to work this year`
- `It's urgent — I'm running out of time or money or both`
- `I'm ready to move now — I'm done waiting`

**Action:** Select "I need something to work this year" option.

---

### STEP 22: Q18 - Biggest Fear (Multiple Choice)

**Assert question text:** `What are you most afraid of?`

**Assert ALL options present:**
- `I'm afraid I'll still be stuck in the same place a year from now`
- `I'm afraid I'll waste more money on something that doesn't work`
- `I'm afraid everyone else will figure it out and I'll get left behind`
- `I'm afraid I'll eventually have to give up on this whole dream`
- `I'm afraid that maybe I'm just not cut out for this`

**Action:** Select "I'm afraid I'll still be stuck in the same place a year from now" option.

---

## CONTACT GATE

### STEP 23: Contact Information

**Assert:** Progress label shows `ALMOST THERE`
**Assert:** Back button NOT visible (`noBackButton: true`)

**Assert question text contains:** `Now I've got what I need.`
**Assert question text contains:** `Enter your contact info below`

**Assert:** Three input fields present:
- Name field with placeholder "Your name"
- Email field with placeholder "your@email.com"
- Phone field with placeholder "(555) 123-4567"

**Assert:** Continue button disabled until all fields filled

**Action:** Fill in:
- Name: `Test User`
- Email: `test@example.com`
- Phone: `5551234567`

**Assert:** Continue button becomes enabled (circular glass with green glow)

**Action:** Click Continue button.

---

## LOADING SCREEN

### STEP 24: Loading Screen

**Assert:** Loading screen appears with smooth fade-in transition (0.8s)
**Assert:** Header and progress bar are NOT visible

**Assert:** Visual elements:
- Brady Badour avatar (100px) centered
- Spinning gradient ring animation around avatar (0.8s rotation)
- Conic-gradient with accent color (#10B981)
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

**Assert:** Screen fades out (0.8s) before transitioning to diagnosis

**Wait:** Allow screen to auto-advance after diagnosis generation completes (10-30 seconds)

---

## DIAGNOSIS SEQUENCE (V7 - 6 Screens for ICP 1-3)

The diagnosis V4 system uses ICP classification based on Q4 (current revenue), Q1 (time), and Q2 (skill level).

**For this test path (ICP 1-2 range based on $5K-$10K income + 3-5 years):**

**Progress Indicator:** Visual dot-based progress (6 dots for ICP 1-3, 5 for ICP 4)

---

### Screen 1: The Mirror

**Assert:** Own header with Brady Badour avatar and name
**Assert:** Back button NOT visible on first screen
**Assert:** Progress indicator: dot 1 active (black pill), dots 2-6 gray

**Assert:** Typing animation on first visit (6-12ms per 3 chars)

**Assert content includes:**
- `## Here's what I see.`
- Reference to their time in game (3-5 years)
- Reference to their goal vs current income gap
- What they tried (Q5 items) → "None of it worked."
- Their daily reality (Q6) in blockquote
- Their confession (Q14) in blockquote — **EXACT words**
- ICP-specific reframe of confession
- Closes with: "Let me show you what I mean."

**Assert:** Continue button appears after typing completes (circular glass with green glow)

**Action:** Click Continue.

---

### Screen 2: The Identity Reveal

**Assert:** Back button IS visible
**Assert:** Progress indicator: dot 1 green, dot 2 active, dots 3-6 gray
**Assert:** If revisiting, content appears instantly (no typing animation)

**Assert content includes:**
- Names their identity label + duration
- `"It worked — kind of. But it never fully fit."`
- Quote Q9 (identity friction) in blockquote
- `"That friction? That's not a flaw. **That's a signal.**"`
- Horizontal rule (`---`) rendered as gradient fade line
- Identity reveal: "You've been a Growth Operator this whole time" (ICP 1) or "You have everything you need to become a Growth Operator" (ICP 2)
- **Confession quoted AGAIN** — connecting it to wrong STRUCTURE
- `"**Same skills. Different structure. Different outcome.**"`

**Action:** Click Continue.

---

### Screen 3: The Path

**Assert:** Progress indicator: dots 1-2 green, dot 3 active, dots 4-6 gray

**Assert content includes:**
- **Opening formula:** "Instead of [Q6 pain], you partner with a creator..."
- AI Education product explanation
- Meta-reveal: `*Just like what you've been experiencing.*` (MANDATORY)
- Equity + ownership mention
- **Closing formula — THREE "No more" lines:**
  - No more [Q6 inversion]
  - No more [Q8 inversion]
  - No more [Q10/confession inversion]
- All three lines must be DISTINCT pains

**Action:** Click Continue.

---

### Screen 4: The Window

**Assert:** Progress indicator: dots 1-3 green, dot 4 active, dots 5-6 gray

**Assert content includes:**
- `## This opportunity exists because of a window.`
- Four forces (exact text):
  - **AI eating white-collar jobs.**
  - **Traditional education failing.**
  - **Creator economy exploding** — $191B now, $528B by 2030
  - **Courses and coaching dying.**
- "In 2-3 years, this will be obvious. Obvious = saturated."
- **Current path projection:** Using Q4 + Q6 + Q8 language
- **Alternative path:** Triple inversion of Q6, Q8, Q10
- `"**Which version do you want?**"`

**Action:** Click Continue.

---

### Screen 5: The Invitation (ICP 1-3 Only)

**Assert:** Progress indicator: dots 1-4 green, dot 5 active, dot 6 gray

**Assert content has 10 ELEMENTS in order:**

**Element 1: Fit Confirmation**
- `## Based on everything you've told me — I think you're a fit.`
- ICP-specific fit statement
- `"**That's exactly who this was built for.**"`

**Element 2: Third Option (ICP 3 only)**
- "You're at a crossroads..." frame

**Element 3: Offer Pillar 1 — CreatorPairing.com**
- `**We help you land a creator partner.**`
- CreatorPairing.com description
- "Within 90 days, you have a signed partnership"
- **Confession tie-in**

**Element 4: Offer Pillar 2 — Mentorfy.ai**
- `**We help you build an AI Education product.**`
- Mentorfy.ai description
- `"Just like what you've been experiencing right now."`

**Element 5: Offer Pillar 3 — GrowthOperator.com AI**
- `**We guide you through launch and scale.**`
- AI trained on 50M+ words
- `"**Imagine what you get on the other side.**"`
- **Confession tie-in**

**Element 6: Support Section (Emotional Climax)**
- `You said [CONFESSION — brief].`
- `That ends the moment you start.`
- 1:1 mentor, weekly calls, network description
- Adapted to their confession

**Element 7: Guarantee**
- `## The guarantee:`
- Best case / Worst case frame
- "We don't disappear."
- "We don't [confession inversion]."
- "We don't stop until you win."

**Element 8: Confession + Fear Callback**
- Full confession quoted
- Q8 fear paraphrased
- Let both sit

**Element 9: The Inversion**
- `**What if you weren't?**`
- 90-day milestone
- 6-month milestone
- 1-year transformation (Q7 based)

**Element 10: Agreement Question**
- `**Do you think this could actually help you?**`
- NO CTA button here — just continue arrow

**Action:** Click Continue.

---

### Screen 6: The Call (ICP 1-3 Only)

**Assert:** Progress indicator: dots 1-5 green, dot 6 active
**Assert:** No Continue button on final screen

**Assert content has 5 ELEMENTS:**

**Element 1: Acknowledgment**
- `## Good. Let's make this real.`
- `You said you think this could work.`

**Element 2: Decision Frame**
- "That future we talked about — partnership in 90 days, something that scales, [confession inversion] — it's possible."
- "But it doesn't happen by accident."
- "It happens because you make a decision."
- `"**This is the decision.**"`

**Element 3: Post-Booking Continuity**
- "Everything you shared is saved."
- "You're not starting over. You're continuing from right here."

**Element 4: Final Confession Callback**
- `You said: "[CONFESSION]"`
- `Let's change that.`

**Element 5: CTA — Calendly Widget**
- **Assert:** Calendly booking widget appears inline after copy
- **Assert:** Widget URL contains: `https://calendly.com/brady-mentorfy/30min`
- **Assert:** Widget URL contains `session_id` parameter with valid session ID
- **Assert:** Widget height is 700px
- **Assert:** Widget theme: backgroundColor FAF6F0, primaryColor 10B981

---

## ICP 4 Path: Graceful Close (Screen 5)

**For users classified as ICP 4 (below $1k income, early stage):**

**Assert:** Only 5 screens total (no Screen 6)
**Assert:** Screen 5 is "Graceful Close" not "The Invitation"

**Assert content includes:**
- `## Here's the truth.`
- "Based on what you've shared, you're earlier in this journey..."
- Validates the path exists
- Specific recommendations (3 items)
- "When you've got [criteria], come back."
- Confession callback with hope
- "Go build. Then come back."

**Assert:** NO Calendly widget
**Assert:** NO CTA button
**Assert:** End of experience

---

## Markdown Rendering Verification (V7 Updated)

**For all diagnosis screens, verify ClientMarkdown renders correctly:**

1. **Bold text** (`**text**`) renders as visually bold
2. **Italic text** (`*text*`) renders in italics
3. **Headers** (`##`) render with proper sizing and spacing
4. **Blockquotes** (`>`) render with green left border
5. **Horizontal rules** (`---`) render as gradient fade lines:
   - Linear gradient from transparent → #ccc → transparent
   - 24px margin above and below
   - 1px height
6. **Lists** render with proper indentation and bullets/numbers

**FAIL examples:**
```
**Bold text** not rendered        <- asterisks visible
--- not rendered                  <- dashes visible as text
> Quote not styled                <- no border/indent
```

**PASS examples:**
- **Bold** appears visually bold
- Horizontal rules show as subtle gradient lines
- Blockquotes have green left border and italic styling

---

## Navigation Verification

### Back Button Behavior

| Step | Back Button State | Style |
|------|-------------------|-------|
| Q1 | **Visible** | GlassBackButton (glassmorphic) |
| Q2-Q5 | **Visible** | GlassBackButton |
| AI Moment 1 | **Not visible** | - |
| Q6-Q9 | **Visible** | GlassBackButton |
| AI Moment 2 | **Not visible** | - |
| Q10-Q13 | **Visible** | GlassBackButton |
| AI Moment 3 | **Not visible** | - |
| Q14 (Confession) | **Not visible** | - |
| AI Moment 4 | **Not visible** | - |
| Q15-Q18 | **Visible** | GlassBackButton |
| Contact Gate | **Not visible** | - |
| Loading | **Not visible** | - |
| Diagnosis 1 | **Not visible** | - |
| Diagnosis 2-6 | **Visible** | Standard back |

### Header/Progress Visibility

| Step | Header Visible | Progress Bar Visible |
|------|----------------|---------------------|
| Q1-Q18 | Yes | Yes (section-based) |
| AI Moments | **No** | **No** |
| Contact Gate | Yes | Yes |
| Loading | **No** | **No** |
| Diagnosis | **No** (uses own) | **No** (uses own 6-dot indicator) |

---

## Visual Style Verification

**Colors:**
- Background: #FAF6F0 (warm beige)
- Accent/Buttons: #10B981 (green)
- Text: #000/#111 (primary), #666/#888 (secondary)

**Typography:**
- Headlines: Lora, Charter, Georgia (serif)
- UI/Body: Geist, -apple-system, sans-serif
- Question text: 18px
- Diagnosis content: 17px with 1.75 line-height
- Loading messages: 20px italic

**Animations (V7):**
- Initial page load: 0.4s fade-in, ease-out
- Question transitions: 0.3s fade-out, 0.3s fade-in (opacity only)
- Loading ring: 0.8s rotation, linear
- Continue button: Pulsing green glow (#10B981)

---

## Confession Echo Verification (V7 Critical)

The confession (Q14) must appear in ALL 6 diagnosis screens:

| Screen | How Confession Appears |
|--------|----------------------|
| 1 - The Mirror | Quoted in blockquote, then reframed |
| 2 - The Identity Reveal | Quoted AGAIN, connected to structure |
| 3 - The Path | Inverted in "No more" closing lines |
| 4 - The Window | Inverted in alternative path vision |
| 5 - The Invitation | Woven through ALL pillars, support, guarantee |
| 6 - The Call | Final callback before CTA |

**TEST:** Search each screen's content for the user's exact confession words. If any screen lacks confession reference, the diagnosis has FAILED.

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
| Initial Fade-In | 1 | Smooth 0.4s opacity fade on first question |
| GlassBackButton | 1+ | Glassmorphic styling on back buttons |
| Q13 Multi-Select | 15 | Multiple selections allowed |
| Q14 Open-Ended | 17 | Text input, not multiple choice |
| AI Moment Continue | 6,11,16,18 | Circular glass button, inline bottom-right |
| Contact Gate | 23 | Name/email/phone required, no back button |
| Loading Screen | 24 | Spinning ring, message cycling, header hidden |
| Diagnosis Screen 1 | 25 | Confession quoted exactly |
| Diagnosis Screen 3 | 27 | Three "No more" lines (distinct) |
| Diagnosis Screen 5 | 29 | 10 elements, agreement question, NO CTA |
| Diagnosis Screen 6 | 30 | CTA with Calendly widget, confession callback |
| Horizontal Rules | All diagnosis | Gradient fade styling |

---

## Architecture Note

```
PhaseFlow (parent)
├── GlassHeader (hidden for loading/diagnosis)
├── StepProgress (hidden for loading/diagnosis)
├── MultipleChoiceStepContent (Q1-Q18)
├── OpenEndedStepContent (Q14)
├── MultiSelectStepContent (Q13)
├── ContactInfoStepContent (Contact Gate)
├── LoadingScreenStepContent (Loading - manages own UI)
│   ├── MentorAvatar with spinning ring
│   ├── MentorBadge
│   └── Message cycling with typing animation
└── DiagnosisSequenceFlow (Diagnosis - manages own navigation)
    ├── Own GlassHeader
    ├── Own StepProgress (1-6 for ICP 1-3, 1-5 for ICP 4)
    └── 6 markdown-rendered screens (ClientMarkdown)
```

Components:
- `src/components/flow/screens/PhaseFlow.tsx` - Main flow controller
- `src/components/flow/screens/LoadingScreenStepContent.tsx` - Loading screen
- `src/components/flow/screens/DiagnosisSequenceFlow.tsx` - Diagnosis sequence
- `src/components/flow/shared/GlassBackButton.tsx` - Glassmorphic back button
- `src/components/flow/shared/GlassHeader.tsx` - Glass-styled header
- `src/components/shared/ClientMarkdown.tsx` - Turbopack-compatible markdown
- `src/agents/growthoperator/diagnosis-v3.ts` - Diagnosis V4 system prompt
