# Growth Operator Flow - End-to-End Test Plan

**Purpose:** Systematic testing of the complete Growth Operator assessment journey using Playwright MCP.

**CRITICAL:** Abort on first failure. Do not continue past any failed assertion - the flow is sequential and later tests depend on earlier state.

---

## Pre-Test Setup

### 1. Start Fresh Dev Server
```bash
bun dev
```
Wait for server to be ready on `localhost:3000`.

### 2. Clear All State
Navigate to `localhost:3000/growthoperator` and execute in browser console:
```javascript
localStorage.clear();
sessionStorage.clear();
```
Refresh the page.

---

## Test Execution

### PHASE 0: Landing Page Verification

**Navigate to:** `http://localhost:3000/growthoperator`

**Assert the following elements exist with EXACT text:**

| Element | Expected Content |
|---------|------------------|
| Headline | `We're Looking For 50 Serious Operators To Partner With Experts To Sell $5k-$15k AI Products` |
| Subheadline | `We Train You. We Find The Expert. You Run The Business.` followed by `Take Our 5-Minute Assessment To See If You Qualify To Work With Us 1-on-1` |
| Button | `See If I Qualify` |
| Disclaimer | `Warning: This will analyze your background, explain the model, and show you what you'd actually be doing whether you qualify or not. Answer thoughtfully for the best experience.` |

**Action:** Click "See If I Qualify" button.

---

### ASSESSMENT PHASE: Single Phase Flow

#### Step 1 - Multiple Choice Question (Situation)

**Assert question text:** `What's your current work situation?`

**Assert ALL options present with EXACT labels:**
- `Working full-time for someone else`
- `Working part-time`
- `Self-employed or freelancing`
- `Running my own business`
- `In between things right now`

**Action:** Select any option (e.g., "Self-employed or freelancing"). Click continue/submit.

---

#### Step 2 - Multiple Choice Question (Background)

**Assert question text:** `What's your professional background?`

**Assert ALL options present with EXACT labels:**
- `Sales or business development`
- `Marketing or advertising`
- `Operations or management`
- `Tech or engineering`
- `Finance or consulting`
- `Creative or content`
- `Other`

**Action:** Select any option (e.g., "Sales or business development"). Click continue/submit.

---

#### Step 3 - Multiple Choice Question (Experience)

**Assert question text:** `Have you tried building a business before?`

**Assert ALL options present with EXACT labels:**
- `No, this would be my first`
- `Yes, one or two attempts`
- `Yes, several attempts`
- `Yes, I'm running one now`

**Action:** Select any option (e.g., "Yes, one or two attempts"). Click continue/submit.

---

#### Step 4 - Multiple Choice Question (Time)

**Assert question text:** `This isn't a "watch some videos" thing. It's building a real business. How much time can you actually commit each week?`

**Assert ALL options present with EXACT labels:**
- `Less than 5 hours`
- `5-10 hours`
- `10-20 hours`
- `20+ hours`

**Action:** Select any option (e.g., "10-20 hours"). Click continue/submit.

---

#### Step 5 - Multiple Choice Question (Capital)

**Assert question text:** `Every real business takes startup capital. What do you have available to invest in building this?`

**Assert ALL options present with EXACT labels:**
- `Under $1,000`
- `$1,000 - $5,000`
- `$5,000 - $10,000`
- `$10,000+`

**Action:** Select any option (e.g., "$5,000 - $10,000"). Click continue/submit.

---

#### Step 6 - Contact Info Form

**Assert question text:** `Almost done. Enter your details to get your personalized analysis.`

**Assert form fields present:**
- First name field with placeholder: `Your first name`
- Email field with placeholder: `your@email.com`
- Phone field with placeholder: `(555) 123-4567`

**Action:** Fill in test data:
- First name: `Test User`
- Email: `test@example.com`
- Phone: `(555) 999-8888`

Click continue/submit.

---

#### Step 7 - First AI Diagnosis Moment

**Assert:** AI response appears (should reflect MC answers and explain the Growth Operator model).

**Assert:** Response should:
1. Address the user
2. Reflect back their situation, background, experience level, time commitment, and capital
3. Explain how the Growth Operator model works for someone in their specific situation
4. Transition to the open-ended questions

**Assert:** Continue button is visible.

**CRITICAL ASSERT:** No Calendly booking widget should appear at this stage.

**Markdown Rendering Verification:**
1. **Take screenshot** of the AI diagnosis area
2. **Assert proper markdown rendering:**
   - `## headers` render as visually distinct section headers (larger font, bold)
   - `**bold text**` renders as bold (not showing asterisks)
   - Paragraphs have visible spacing between them (blank lines respected)
   - No raw markdown syntax visible in the rendered output
3. **Inspect DOM** to verify markdown is converted to HTML elements:
   - Headers should be `<h2>` elements
   - Bold should be `<strong>` or `<b>` elements
   - Paragraphs should be `<p>` elements or have `<br>` spacing

**Action:** Click continue button.

---

#### Step 8 - Long Answer Question (What's Going On)

**Assert question text:** `What's actually going on in your life right now that made you stop and pay attention to this?`

**Assert placeholder text:** `Be honest...`

**Action:** Enter text: `I've been working in tech for 5 years but I'm tired of building other people's dreams. I want to build something of my own and have been looking for the right opportunity.`

Click continue/submit.

---

#### Step 9 - Long Answer Question (Why This)

**Assert question text:** `You've probably seen a hundred opportunities. What's different about this one?`

**Assert placeholder text:** `What caught your attention...`

**Action:** Enter text: `The partnership model is unique - I don't have to be the expert or create the product. I can focus on what I'm good at: sales and operations. The AI angle is also compelling given where the market is heading.`

Click continue/submit.

---

#### Step 10 - Long Answer Question (Why You)

**Assert question text:** `We get hundreds of people through this page. We accept less than 50 to work with us directly. Why should you be one of them?`

**Assert placeholder text:** `Make your case...`

**Action:** Enter text: `I have a track record of exceeding sales targets, I'm willing to put in the time, and I have the capital to invest properly. I'm not looking for a get-rich-quick scheme - I want to build a real business.`

Click continue/submit.

---

#### Step 11 - Final AI Diagnosis Moment (CRITICAL)

**Assert:** AI response appears (should make a qualification decision based on ALL answers).

**Assert:** Response should:
1. Reflect their situation with depth (pull from "what's going on" answer)
2. Connect to the opportunity (pull from "why this" answer)
3. Provide honest assessment of fit (pull from "why you" answer)
4. Make a clear decision

**Markdown Rendering Verification:**
1. **Take screenshot** of the final AI diagnosis area
2. **Assert proper markdown rendering:**
   - `## headers` render as visually distinct section headers (larger font, bold)
   - `**bold text**` renders as bold (not showing asterisks)
   - Paragraphs have visible spacing between them (blank lines respected)
   - No raw markdown syntax visible in the rendered output
3. **Inspect DOM** to verify markdown is converted to HTML elements:
   - Headers should be `<h2>` elements
   - Bold should be `<strong>` or `<b>` elements
   - Paragraphs should be `<p>` elements or have `<br>` spacing

**CONDITIONAL BEHAVIOR - Two possible outcomes:**

##### Outcome A: Qualified (Expected with test data above)

**Assert:** Calendly booking widget is embedded inline with the diagnosis.
**Assert:** Booking widget URL: `https://calendly.com/brady-mentorfy/30min`
**Assert:** The diagnosis text appears ABOVE the calendar embed (via `beforeText`).
**Assert:** Optional follow-up text may appear below the calendar.

##### Outcome B: Not Qualified

**Assert:** No Calendly booking widget appears.
**Assert:** AI provides honest, kind explanation of why it's not the right timing.
**Assert:** Continue button is visible to exit the flow.

---

## Test Scenarios

### Scenario 1: Qualified Applicant (Happy Path)

Use test data that meets qualification criteria:
- **Time:** 10-20 hours or 20+ hours (10+ hours/week)
- **Capital:** $5,000 - $10,000 or $10,000+ ($5k+ capital)
- **Experience:** Any relevant background
- **Open answers:** Thoughtful, specific responses

**Expected Result:** Calendly widget appears in final diagnosis.

---

### Scenario 2: Unqualified - Insufficient Time

Use test data with disqualifying time commitment:
- **Time:** Less than 5 hours

**Expected Result:** No Calendly widget. Kind rejection message.

---

### Scenario 3: Unqualified - Insufficient Capital

Use test data with disqualifying capital:
- **Capital:** Under $1,000

**Expected Result:** No Calendly widget. Kind rejection message.

---

### Scenario 4: Unqualified - Vague Answers

Use test data with qualification-level MC answers but:
- **Open answers:** Very short, vague, or low-effort responses like "idk" or "money"

**Expected Result:** No Calendly widget. Feedback about needing more thoughtful engagement.

---

## Test Complete

If all assertions pass for Scenario 1 (Happy Path), the Growth Operator flow is working correctly.

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
| Landing Page | 0 | Headline, subheadline, button, disclaimer all visible |
| First Diagnosis | 7 | AI reflects MC answers, explains model, NO booking widget, markdown renders correctly |
| Final Diagnosis (Qualified) | 11 | AI makes decision, Calendly widget appears inline, markdown renders correctly |
| Final Diagnosis (Unqualified) | 11 | AI makes decision, NO widget, kind rejection, markdown renders correctly |

## Markdown Rendering Failure Examples

**FAIL - Raw syntax visible:**
```
## Your Growth Operator Diagnosis  ← raw ## visible
**Bold text** not rendered        ← asterisks visible
```

**FAIL - No visual hierarchy:**
- Headers same size as body text
- No spacing between paragraphs
- All text runs together

**PASS - Proper rendering:**
- Headers are larger/bolder than body text
- Bold text appears bold without asterisks
- Clear paragraph separation
- Professional, readable formatting

---

## Key Differences from Rafael TATS Flow

| Aspect | Rafael TATS | Growth Operator |
|--------|-------------|-----------------|
| Phases | 4 phases with chat between | Single assessment phase |
| AI Diagnoses | One per phase | Two in one phase (first + final) |
| Booking | Unlocks after Phase 4 | Conditional - AI decides based on qualification |
| Chat | Available between phases | Not part of flow |
| Booking Trigger | Phase completion | AI tool call |
