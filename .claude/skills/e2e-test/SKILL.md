---
name: e2e-test
description: "Run end-to-end tests using Playwright MCP. Requires a test plan document. Use: /e2e-test <test-plan-path> [--prod] [--continue]. Stops on first failure by default. Keywords: e2e, test, playwright, qa, end-to-end."
---

# E2E Test Runner

You are a **staff-level QA tester**. Your job is to methodically execute end-to-end test plans using Playwright MCP, identify bugs, and file bd issues for any failures.

## Usage

```
/e2e-test <test-plan-path> [--prod] [--continue]
```

**Required:** `<test-plan-path>` - Path to the test plan document (e.g., `docs/GROWTHOPERATOR_V2_E2E_TEST_PLAN.md`)

**Optional flags:**
- `--prod` - Test against production (https://mentorfy.ai) instead of dev server
- `--continue` - Continue through ALL issues instead of stopping on first failure

## Workflow

### 1. Parse Arguments

Extract from the user's command:
- `TEST_PLAN_PATH`: The path to the test plan document (REQUIRED)
- `IS_PROD`: Whether `--prod` flag was specified
- `CONTINUE_ON_FAILURE`: Whether `--continue` flag was specified (default: FALSE)

If no test plan path provided, respond with usage instructions and stop.

### 2. Read Test Plan

```bash
# Read the test plan document
Read $TEST_PLAN_PATH
```

Understand the test structure, assertions, and expected behaviors.

### 3. Environment Setup

#### If Testing Dev (default):

```bash
# Kill any existing dev server
pkill -f "bun.*dev" || true

# Start fresh dev server in background
cd /Users/elijah/code/mentorfy && bun dev &

# Wait for server to be ready
sleep 3
```

**Target URL:** `http://localhost:3000`

#### If Testing Production (`--prod`):

Skip server management.

**Target URL:** `https://mentorfy.ai`

### 4. Clear Browser State

Before starting tests:

```javascript
// Execute via browser_evaluate after navigating to target
localStorage.clear();
sessionStorage.clear();
```

Then refresh the page.

### 5. Execute Test Plan

Run through the test plan systematically:

1. **Use TodoWrite** to create a checklist of all test steps
2. **Mark each step in_progress** before executing
3. **Execute assertions** using Playwright MCP tools:
   - `browser_navigate` - Go to URLs
   - `browser_snapshot` - Get page state for assertions
   - `browser_click` - Interact with elements
   - `browser_type` - Enter text
   - `browser_wait_for` - Wait for content/animations
   - `browser_evaluate` - Run JavaScript assertions
4. **Mark each step completed** after passing

### 6. Bug Handling

**DEFAULT BEHAVIOR: STOP ON FIRST FAILURE.**

This is critical because later tests often depend on earlier state. A failure in step 3 can cascade into false failures in steps 4-12. Stop immediately, fix the issue, then resume.

When an assertion fails:

1. **Take a screenshot immediately:**
   ```
   browser_take_screenshot with descriptive filename (e.g., "diagnosis-screen-missing-progress.png")
   ```
   **This is MANDATORY.** Every bug report must include screenshot evidence.

2. **Document the failure:**
   - Step number and name
   - Expected behavior
   - Actual behavior
   - Screenshot filename
   - Console errors (if any)

3. **File a bd issue:**
   ```bash
   bd create "E2E: <brief description>" -t bug -p 1 -d "<detailed description with expected vs actual, include screenshot path>"
   ```

4. **STOP and wait for instructions.** Tell the user:
   - What failed
   - The bd issue ID
   - That you're waiting for them to fix it or instruct you to continue

**ONLY if `--continue` flag was specified:** Proceed through ALL failures, filing bd issues for each, and provide a full report at the end.

### 7. Watch Server Logs

If testing dev, monitor for backend errors:

```bash
# Check recent server output for errors
# Note any API errors, crashes, or warnings
```

Include relevant server-side errors in bug reports.

### 8. Final Report

After completing the test plan, provide a summary:

```
## E2E Test Results

**Environment:** [Dev/Production]
**Test Plan:** <path>
**Date:** <timestamp>

### Summary
- Total Steps: X
- Passed: Y
- Failed: Z

### Failures
| Step | Issue | BD Issue |
|------|-------|----------|
| STEP 3 | Q2 personalization missing | mf-abc |

### Notes
<any observations or warnings>
```

## Critical Rules

1. **Never skip the test plan** - It's required
2. **Always clear state first** - localStorage, sessionStorage
3. **STOP ON FIRST FAILURE** - Default behavior. File the bug, report it, wait for instructions
4. **Only continue if `--continue` flag** - Then complete the entire flow
5. **File bugs immediately** - Don't batch them up
6. **ALWAYS take screenshots for failures** - No bug report without visual evidence
7. **Use TodoWrite** - Track progress visibly
8. **Be thorough** - Verify all assertions in the test plan
9. **Report clearly** - Structured output for easy review

## Example Invocations

```bash
# Test against dev server (default) - stops on first failure
/e2e-test docs/GROWTHOPERATOR_V2_E2E_TEST_PLAN.md

# Test against production - stops on first failure
/e2e-test docs/GROWTHOPERATOR_V2_E2E_TEST_PLAN.md --prod

# Continue through ALL failures (useful for first-pass bug discovery)
/e2e-test docs/GROWTHOPERATOR_V2_E2E_TEST_PLAN.md --continue

# Production + continue through all failures
/e2e-test docs/GROWTHOPERATOR_V2_E2E_TEST_PLAN.md --prod --continue
```
