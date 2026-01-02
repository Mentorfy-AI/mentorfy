# Playwright Tests

This directory contains end-to-end tests for the Mentorfy application using Playwright.

## Setup

### 1. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 2. Set Environment Variables

The tests require authentication. Create a `.env.local` file in the project root or export these variables:

```bash
export TEST_USER_EMAIL="your-test-user@example.com"
export TEST_USER_PASSWORD="your-test-password"
```

Or run tests with inline environment variables:

```bash
TEST_USER_EMAIL=user@example.com TEST_USER_PASSWORD=password pnpm test
```

## Running Tests

### Run all tests (headless)
```bash
pnpm test
```

### Run tests in UI mode (recommended for debugging)
```bash
pnpm test:ui
```

### Run tests in debug mode
```bash
pnpm test:debug
```

### Run a specific test file
```bash
pnpm test tests/conversation-loading.spec.ts
```

## Test Files

### `conversation-loading.spec.ts`
Tests the conversation loading functionality from the hamburger menu.

**Bug being tested:** When clicking on a conversation in the "Recent Chats" section of the hamburger menu, the conversation page loads but shows an empty chat interface instead of displaying existing messages.

**What the test does:**
1. Logs in using Clerk authentication
2. Navigates to the chat page
3. Opens the hamburger menu
4. Clicks on the first conversation in "Recent Chats"
5. Verifies that messages are loaded (not empty state)

**Expected result after fix:** Test should PASS when the bug is fixed.

## Authentication

The tests use Clerk authentication. The test will:
1. Check if the user is already authenticated (via cookies)
2. If not authenticated, perform login using the credentials from environment variables
3. If already authenticated, skip login and proceed with tests

This means you only need to log in once per test session if cookies are preserved.

## Tips

- Use `pnpm test:ui` to visually debug tests
- Check the `playwright-report` directory for detailed test results after failures
- The test will output detailed console logs showing each step
- If authentication fails, double-check your credentials and that the user exists in your Clerk instance
