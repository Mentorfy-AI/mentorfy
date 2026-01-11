# Growth Operator V3 Flow - End-to-End Test Plan

**Purpose:** Systematic testing of the complete Growth Operator v3 assessment journey using Playwright MCP.

**Version:** 3.0 (Eugene Schwartz copywriting rewrite, Gemini 2.5 Flash Lite, simplified final diagnosis)

**CRITICAL:** Abort on first failure. Do not continue past any failed assertion - the flow is sequential and later tests depend on earlier state.

---

## What Changed from V2

| Aspect | V2 | V3 |
|--------|----|----|
| AI Model | Claude Haiku 4.5 | Gemini 2.5 Flash Lite |
| AI Moments | 5 (D1, D2, D3, path-reveal, fit-assessment) | 4 (D1, D2, D3, final-diagnosis) |
| D1 Focus | Model breakdown + absolution | Pure validation/absolution only |
| D2 Focus | Five roles concept | Shovel sellers paradigm + proof |
| D3 Focus | Future pace + "Growth Operator" tease | Full reveal + math + personalized picture |
| Final Step | path-reveal + fit-assessment (2 steps) | final-diagnosis (1 step with booking) |
| Prompt Style | Instructional | XML-structured with examples |

---

## Pre-Test Setup

### 1. Start Fresh Dev Server
```bash
bun dev
```
Wait for server to be ready on `localhost:3000`.

### 2. Verify Environment
Ensure `GOOGLE_GENERATIVE_AI_API_KEY` is set (diagnosis steps now use Gemini).

### 3. Clear All State
Navigate to `localhost:3000/growthoperator` and execute in browser console:
```javascript
localStorage.clear();
sessionStorage.clear();
```
Refresh the page.

---

## Flow Overview

The v3 flow consists of:
- **7 Questions** (3 multiple-choice, 4 long-answer)
- **4 AI Moments** (diagnosis-1, diagnosis-2, diagnosis-3, final-diagnosis)
- **3 Disqualification Exit Points** (Q1, Q6, Q7)
- **2 Dynamically Personalized Questions** (Q2, Q3 adapt based on previous answers)

**Total Steps:** 12 (Landing + 7 Questions + 4 AI Moments)

---

## Test Execution

### PHASE 0: Landing Page Verification

**Navigate to:** `http://localhost:3000/growthoperator`

**Assert the following elements exist with EXACT text:**

| Element | Expected Content |
|---------|------------------|
| Mentor Avatar | Brady Badour avatar image visible |
| Callout (italic) | `In the next 5-10 minutes I'll show you why online business hasn't worked for you yet...` |
| Headline | `Then I'll show you the best business model for your situation in the new 2026 AI economy` |
| Button | `Start Conversation` with arrow |
| Disclaimer (italic) | `Warning: This experience adapts based on your answers. Please thoughtfully respond to get the most value from this. Enjoy :)` |

**Action:** Click "Start Conversation" button.

---

### STEP 1: Q1 - Business Model Selection (Multiple Choice)

**Assert question text:** `Let's start easy. What have you tried?`

**Assert ALL options present with EXACT labels:**
- `Ecommerce (dropshipping, Amazon FBA, print on demand, reselling)`
- `Agency / Services (SMMA, lead gen, web dev, AI automation, freelancing)`
- `Sales (high ticket closing, appointment setting, dialing)`
- `Content Creation (YouTube, TikTok, podcast, newsletter, blog)`
- `Education Products (courses, coaching, consulting, communities)`
- `Affiliate Marketing (Amazon, ClickBank, niche sites, network marketing)`
- `Software (SaaS, apps, Chrome extensions, no-code tools)`
- `Investing (crypto, forex, stocks, options, real estate)`
- `I have not tried a business model yet`

**Assert:** Questions are LEFT-ALIGNED (not centered)

**Action:** Select "Agency / Services" option. (Clicking option auto-advances)

**EXIT CONDITION TEST (Scenario 2):** If `I have not tried a business model yet` is selected, assert DisqualificationScreen appears with:
- Headline: `This is not for you`
- Message containing: `This experience is designed for people who've already tried building something online.`

---

### STEP 2: Q2 - What Happened (Long Answer, Personalized)

**Assert:** A personalized question appears that:
1. Mirrors back the selected business model (e.g., "Agency. Got it.")
2. Shows understanding of that model (e.g., "The outreach, the client work, the churn...")
3. Ends with: `Tell me what happened. How far did you get? What made you stop?`

**Assert:** Typing animation occurs (blinking cursor, text appears character by character)

**Assert:** Questions are LEFT-ALIGNED

**Assert placeholder text:** `Be honest about what happened...`

**Action:** Enter text: `I ran a copywriting agency for about a year. Got up to 5 clients but the churn was brutal. Every month felt like starting over. I was doing all the fulfillment myself and couldn't figure out how to scale without burning out.`

**Note:** Include specific details like "copywriting" - D2 should use this specific word, not generic "agency".

**Assert:** Continue button becomes enabled (green) after minimum text entered.

**Action:** Click "Continue" button.

---

### STEP 3: Q3 - Why It Failed (Long Answer, Personalized)

**Assert:** A personalized question appears that:
1. Mirrors back specific details from Q2 answer (e.g., "So you got some traction..." or similar)
2. Shows insight about their situation
3. Ends with: `Why didn't it work?`

**Assert:** Typing animation occurs for the personalized question

**Assert placeholder text:** `What do you think went wrong...`

**Action:** Enter text: `I think I was trying to do everything myself. Sales, fulfillment, client management, all of it. I didn't have systems or processes. Every client was custom work and I couldn't step away without things falling apart.`

**Action:** Click "Continue" button.

---

### STEP 4: AI Moment - Diagnosis 1 (Validation & Absolution)

**Assert:** AI response streams in with blinking cursor while generating

**Assert:** Response should (80-120 words):
1. **Mirror their grind** - Reference their specific story (copywriting, clients, burnout)
2. **Name the wall** - The moment it started to crack
3. **Show the pattern** - They're not alone, everyone hits this
4. **Name the trap** - One punchy line (e.g., "You didn't build a business. You built a job...")
5. **End with absolution** - "**You weren't failing.** You were [absolution]"

**CRITICAL - What should NOT appear:**
- NO "here's what they didn't tell you" (that's D2)
- NO mention of gurus making money teaching (that's D2)
- NO "Growth Operator" mention yet

**Markdown Rendering Verification:**
1. **Assert** `**You weren't failing.**` renders as bold
2. **Assert** short paragraphs (1-2 sentences) with blank lines between
3. **Assert** response feels personal, not generic

**Assert:** Continue button appears after streaming completes.

**Action:** Click "Continue" button.

---

### STEP 5: AI Moment - Diagnosis 2 (The Paradigm Shift)

**Assert:** AI response streams in

**Assert:** Response should (120-150 words):
1. **Open with** (bold, personalized): `**Here's what the person who taught you [their specific model] didn't tell you.**`
   - CRITICAL: Should say "copywriting" not "agency" if they mentioned copywriting in Q2
2. **The twist**: "They're not making their money [doing the thing]. They're making it teaching YOU how to do it."
3. **Gold rush metaphor**: "It's like the gold rush... the people who got rich were selling shovels."
4. **The unlock**: "you don't need to BE an expert... just need to partner up with one ;)"
5. **Proof with specifics**:
   - "**I've made over $3 million doing this.**"
   - Numbered list with names and income:
     - 1. **Kade** - was an artist. Now **$30K/month** with an AI YouTube creator.
     - 2. **Nick** - was a server borrowing rent money. Now **$50K/month** with a woodworking creator.
     - 3. **Carson** - paid $7K for a course that didn't work. Now **$100K/month** with a tattoo creator.
6. **Skepticism acknowledgment**: "Now... I know those numbers sound crazy"
7. **Future pace**: "I'll prove it once you finish this. Real case studies with screenshots."
8. **Transition**: "There's a name for this role... Let me break it down for you on the next screen"

**Markdown Rendering Verification:**
1. **Assert** opener is bold
2. **Assert** "$3 million" claim is bold
3. **Assert** income numbers in case studies are bold ($30K/month, $50K/month, $100K/month)
4. **Assert** numbered list renders properly (1. 2. 3.)

**Assert:** Continue button appears after streaming completes.

**Action:** Click "Continue" button.

---

### STEP 6: AI Moment - Diagnosis 3 (The Reveal)

**Assert:** AI response streams in

**Assert:** Response should (100-130 words):
1. **The name** (bold): `**It's called being a Growth Operator.**`
2. **Simple definition** (3 beats):
   - "You find an expert who already has the knowledge."
   - "Help them turn it into income."
   - "Take a cut of everything."
   - "That's it."
3. **Personalized picture**: "Imagine a [relevant expert type] with 50K followers..."
   - Should match their background (copywriting → "copywriting coach")
   - "But they're too busy doing the work to even think about scaling."
4. **The math** (bold numbers):
   - "50K followers. 2% buy at $50/month. **$50,000/month.**"
   - "20% is yours. **$10,000/month.** One partnership."
5. **Contrast/relief lines** personalized to their old pain:
   - e.g., "No clients to chase. No deadlines breathing down your neck. No getting replaced."
6. **The pivot**:
   - `**Just you. Running the show.**`
   - "I want to show you how this could work for you."
   - "But first—I need to see if you're serious."

**Markdown Rendering Verification:**
1. **Assert** "It's called being a Growth Operator" is bold
2. **Assert** money numbers are bold ($50,000/month, $10,000/month)
3. **Assert** "Just you. Running the show." is bold

**Assert:** Continue button appears after streaming completes.

**Action:** Click "Continue" button.

---

### STEP 7: Q4 - Vision (Long Answer)

**Assert question text (multi-line):**
```
Imagine this works. You're making $15K-$25K a month six months from now.

What would actually change in your life?
```

**Assert:** Questions are LEFT-ALIGNED

**Assert placeholder text:** `What would be different...`

**Action:** Enter text: `I'd finally be able to quit my 9-5 and have the freedom to travel whenever I want. I could actually take care of my family and not stress about where the next paycheck is coming from.`

**Action:** Click "Continue" button.

---

### STEP 8: Q5 - Why Now (Long Answer)

**Assert question text (multi-line):**
```
You've seen opportunities before. You've scrolled past 100s of ads.

But you're still here.

Why today? What's actually going on that made you stop and pay attention to this?
```

**Assert placeholder text:** `Be real about what brought you here...`

**Action:** Enter text: `I'm tired of watching everyone else figure it out while I'm still stuck in the same place. Something about this felt different - like it actually makes sense instead of just being another course or program.`

**Action:** Click "Continue" button.

---

### STEP 9: Q6 - Commitment (Multiple Choice)

**Assert question text (multi-line):**
```
This is NOT a side project.

This is building a real business. It takes real commitment. Real focus. Real work.

Are you ready for that?
```

**Assert ALL options present with EXACT labels:**
- `Yes, I'm ready`
- `Not yet`

**Action:** Select "Yes, I'm ready" option. (Clicking option auto-advances)

**EXIT CONDITION TEST (Scenario 3):** If `Not yet` is selected, assert DisqualificationScreen appears with:
- Headline: `That's honest`
- Message containing: `Most people aren't ready. And there's no shame in that.`

---

### STEP 10: Q7 - Investment Capital (Multiple Choice)

**Assert question text (multi-line):**
```
Building a real business takes capital. The more you have, the faster you can move.

How much do you have available to invest in building this?
```

**Assert ALL options present with EXACT labels:**
- `Less than $1K`
- `$1K - $5K`
- `$5K - $10K`
- `$10K - $25K`
- `$25K+`

**Action:** Select "$5K - $10K" option. (Clicking option auto-advances)

**EXIT CONDITION TEST (Scenario 4):** If `Less than $1K` is selected, assert DisqualificationScreen appears with:
- Headline: `Not quite yet`
- Message containing: `Every real business takes startup capital. Under $1K makes it nearly impossible to move fast enough.`

---

### STEP 11: AI Moment - Final Diagnosis (The Close + Booking)

**Assert:** AI response streams in

**Assert:** Response should (150-200 words before booking):
1. **Acknowledgment**:
   - `**You made it.**`
   - "Most people don't get this far. They click away. Tell themselves 'maybe later.'"
   - "But you stayed."
2. **Callback to Q4** (emotional core): "You told me [what would change - quitting 9-5, freedom, family]"
3. **Callback to Q5** (why now): "You told me [why now - tired of watching others, felt different]"
4. **Selection frame**:
   - "And based on everything you've shared..."
   - `**You're exactly who we're looking for.**`
   - "We only work with a small number of people 1 on 1. Not everyone qualifies. You do."
5. **Next step**:
   - `**Here's your next step.**`
   - "Book a call. 30 minutes. I'll map out exactly how this would work for your situation..."
   - "If we're a fit — we build this together."
   - "If not — I'll tell you straight. No games."

**CRITICAL ASSERT - Calendly Booking Widget:**
- **Assert:** Calendly booking widget appears inline after the main copy
- **Assert:** Widget URL contains: `https://calendly.com/brady-mentorfy/30min`

**Assert:** After the Calendly embed, future pace text appears:
- `**Once you book, we keep going.**`
- "I'll take everything you've shared and start mapping your path to [their Q4 goal]."
- "By the time we get on the call, I'll already have ideas for you."
- `**This is just the beginning.**`

**Markdown Rendering Verification:**
1. **Assert** "You made it" is bold
2. **Assert** "You're exactly who we're looking for" is bold
3. **Assert** "Here's your next step" is bold
4. **Assert** "Once you book, we keep going" is bold
5. **Assert** "This is just the beginning" is bold

---

## Test Scenarios

### Scenario 1: Qualified Applicant (Happy Path)

Use test data that meets ALL qualification criteria:
- **Q1:** Any business model EXCEPT "I have not tried a business model yet"
- **Q2-Q5:** Thoughtful, specific responses (3+ sentences each)
- **Q6:** "Yes, I'm ready"
- **Q7:** "$1K - $5K" or higher ($1k+ capital)

**Expected Result:** Calendly widget appears in final diagnosis (Step 11).

---

### Scenario 2: Disqualified - Never Tried (Q1)

**Q1 Selection:** `I have not tried a business model yet`

**Expected Result:** DisqualificationScreen with:
- Headline: `This is not for you`
- Message: `This experience is designed for people who've already tried building something online...`
- No further progression possible

---

### Scenario 3: Disqualified - Not Ready (Q6)

Complete Q1-Q5 with qualifying answers, then:

**Q6 Selection:** `Not yet`

**Expected Result:** DisqualificationScreen with:
- Headline: `That's honest`
- Message: `Most people aren't ready. And there's no shame in that...`
- No further progression possible

---

### Scenario 4: Disqualified - Insufficient Capital (Q7)

Complete Q1-Q6 with qualifying answers, then:

**Q7 Selection:** `Less than $1K`

**Expected Result:** DisqualificationScreen with:
- Headline: `Not quite yet`
- Message: `Every real business takes startup capital. Under $1K makes it nearly impossible...`
- No further progression possible

---

## Navigation Verification

### Back Button Behavior

Back button works **within phases only**. It should NOT render at phase boundaries or during AI moments.

| Current Step | Back Button State | Behavior |
|--------------|-------------------|----------|
| Step 1 (Q1) | **Not rendered** | First step of phase, no back |
| Step 2 (Q2) | **Not rendered** | First step of Phase C, cannot go back to Phase B |
| Step 3 (Q3) | **Rendered** | Returns to Q2 (within Phase C) |
| Steps 4-6 (AI Moments) | **Not rendered** | AI response phase, no navigation |
| Step 7 (Q4) | **Not rendered** | First step of Phase E, cannot go back to Phase D |
| Step 8 (Q5) | **Rendered** | Returns to Q4 (within Phase E) |
| Step 9 (Q6) | **Rendered** | Returns to Q5 (within Phase E) |
| Step 10 (Q7) | **Rendered** | Returns to Q6 (within Phase E) |
| Step 11 (Final Diagnosis) | **Not rendered** | AI response phase, no navigation |

**Back Button Test Cases:**

**TEST: Back button works within Phase C (Q2-Q3)**
1. Complete Q2, arrive at Q3
2. Assert back button IS visible
3. Click back button
4. Assert returns to Q2 with previous answer preserved

**TEST: Back button works within Phase E (Q4-Q7)**
1. Complete Q4, arrive at Q5
2. Assert back button IS visible
3. Click back button
4. Assert returns to Q4 with previous answer preserved

---

## Personalization Verification

### D2 Personalization (CRITICAL)

The D2 opener MUST use the user's SPECIFIC words, not the generic category.

| Q2 Mentioned | D2 Should Say | D2 Should NOT Say |
|--------------|---------------|-------------------|
| "copywriting" | "Here's what the person who taught you copywriting didn't tell you" | "...taught you agency..." |
| "real estate" | "Here's what the person who taught you real estate didn't tell you" | "...taught you investing..." |
| "dropshipping" | "Here's what the person who taught you dropshipping didn't tell you" | "...taught you ecommerce..." |
| "appointment setting" | "Here's what the person who taught you appointment setting didn't tell you" | "...taught you sales..." |

### D3 Personalization

Expert type should match their background:

| Their Model | Expected Expert Type |
|-------------|---------------------|
| Copywriting | "copywriting coach" or "content strategist" |
| Ecommerce/dropshipping | "ecommerce mentor" or "Shopify expert" |
| Agency/services | "[their specific service] consultant" |
| Sales | "sales trainer" or "closer coach" |
| Real estate | "real estate educator" |

### Final Diagnosis Callbacks

The final diagnosis MUST reference:
1. **Q4 emotional core** - Extract the FEELING (freedom, family, quit job)
2. **Q5 urgency** - Extract what's driving them NOW (tired of waiting, felt different)

---

## Disqualification Screen Verification

For each disqualification screen, verify:

1. **Layout:**
   - Mentor avatar (Brady) centered at top
   - Headline in large serif font
   - Message with proper line breaks
   - Mentorfy watermark at bottom

2. **No Escape:**
   - No back button visible
   - No continue button
   - No way to proceed (must refresh and restart)

---

## Issue Reporting Format

When an assertion fails, report using this format:

```
## FAILED: [Step X or Scenario Y]

**Expected:** [What should have happened]
**Actual:** [What actually happened]
**Screenshot:** [If applicable]
**Console Errors:** [Any JS errors]
```

---

## Summary of Key Checkpoints

| Checkpoint | Step | Expected Behavior |
|------------|------|-------------------|
| Landing Page | 0 | Callout, headline, button, disclaimer all visible |
| Q1 Exit Condition | 1 | "Not tried yet" → Disqualification |
| Q2 Personalization | 2 | Question adapts based on Q1 model selection |
| Q3 Personalization | 3 | Question adapts based on Q2 answer |
| Diagnosis 1 | 4 | Validation + absolution, NO paradigm shift yet |
| Diagnosis 2 | 5 | Shovel sellers paradigm, SPECIFIC model name, proof with Kade/Nick/Carson |
| Diagnosis 3 | 6 | "Growth Operator" reveal, personalized expert type, math |
| Q6 Exit Condition | 9 | "Not yet" → Disqualification |
| Q7 Exit Condition | 10 | "Less than $1K" → Disqualification |
| Final Diagnosis | 11 | Callbacks to Q4/Q5, selection frame, Calendly widget + afterText |

---

## Markdown Rendering Failure Examples

**FAIL - Raw syntax visible:**
```
**Bold text** not rendered        ← asterisks visible
*Italic text* not rendered        ← asterisks visible
```

**FAIL - No visual hierarchy:**
- All text runs together without paragraph breaks
- Bold/italic indistinguishable from regular text

**PASS - Proper rendering:**
- **Bold** appears visually bold
- *Italics* appear visually italic
- Clear paragraph separation
- Short paragraphs (1-2 sentences) with breathing room

---

## Q2 Personalization Reference

| Q1 Selection | Expected Q2 Opening |
|--------------|---------------------|
| Ecommerce | "Ecommerce. Got it. The product research, the ads, the suppliers..." |
| Agency / Services | "Agency. Got it. The outreach, the client work, the churn..." |
| Sales | "Sales. Got it. The dials, the commission, the grind..." |
| Content Creation | "Content. Got it. The posting, the algorithm, the waiting..." |
| Education Products | "Education products. Got it. The course, the launch, the audience problem..." |
| Affiliate Marketing | "Affiliate. Got it. The traffic, the commissions, the dependency..." |
| Software | "Software. Got it. The building, the launching, the getting people to use it..." |
| Investing | "Investing. Got it. The charts, the plays, the wins and losses..." |
