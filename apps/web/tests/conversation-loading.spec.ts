import { test, expect } from '@playwright/test';

/**
 * Test: Conversation Loading from Hamburger Menu
 *
 * Bug: When clicking on a conversation in the hamburger menu's "Recent Chats" section,
 * the conversation page loads but shows an empty chat interface instead of displaying
 * the existing messages.
 *
 * Expected behavior: Messages should load and display properly.
 * Actual behavior: Empty chat with "Start a conversation" placeholder.
 *
 * Root cause: /api/conversations/[conversationId]/messages was only checking org ownership,
 * not user ownership, causing the wrong conversations to be loaded.
 */

test.describe('Conversation Loading Bug', () => {
  test.beforeEach(async ({ page }) => {
    // Step 1: Navigate to the app
    await page.goto('/');

    // Step 2: Check if already authenticated (redirected to /dashboard or /chat)
    await page.waitForURL(/\/(dashboard|chat|sign-in)/, { timeout: 10000 });

    const currentUrl = page.url();
    console.log('Current URL after initial navigation:', currentUrl);

    // Step 3: If on sign-in page, perform login
    if (currentUrl.includes('sign-in')) {
      console.log('User not authenticated, signing in...');

      // Wait for Clerk sign-in form to load
      await page.waitForSelector('input[name="identifier"]', { timeout: 10000 });

      // Get credentials from environment variables
      const email = process.env.TEST_USER_EMAIL;
      const password = process.env.TEST_USER_PASSWORD;

      if (!email || !password) {
        throw new Error(
          'TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables must be set. ' +
          'Example: TEST_USER_EMAIL=test@example.com TEST_USER_PASSWORD=password123 pnpm test'
        );
      }

      // Fill in email/username
      await page.fill('input[name="identifier"]', email);
      await page.click('button[type="submit"]');

      // Wait for password field to appear
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');

      // Wait for successful login (redirect to dashboard or chat)
      await page.waitForURL(/\/(dashboard|chat)/, { timeout: 15000 });
      console.log('Successfully logged in!');
    } else {
      console.log('User already authenticated, skipping login');
    }

    // Step 4: Navigate to chat page
    await page.goto('/chat');

    // Step 5: Wait for the page to load and user to be authenticated
    await page.waitForSelector('[role="button"]:has-text("Open navigation menu")', {
      timeout: 10000
    });

    console.log('Chat page loaded successfully');
  });

  test('should load messages when clicking conversation from hamburger menu', async ({ page }) => {
    // Step 1: Open the hamburger menu
    await page.click('[role="button"]:has-text("Open navigation menu")');

    // Step 2: Wait for the menu to open and conversations to load
    await page.waitForSelector('[role="dialog"]');
    await page.waitForSelector('text=Recent Chats');

    // Step 3: Find the first conversation in the list
    // The conversations are buttons with titles like "how can i get into harvard? 1 day ago"
    const firstConversation = page.locator('[role="dialog"] button').filter({
      has: page.locator('p:has-text(" ago")')
    }).first();

    // Get the conversation title for debugging
    const conversationTitle = await firstConversation.locator('p').first().textContent();
    console.log('Clicking conversation:', conversationTitle);

    // Step 4: Click the conversation
    await firstConversation.click();

    // Step 5: Wait for navigation to the conversation page
    await page.waitForURL(/\/chat\/[a-f0-9-]+/);

    // Step 6: Wait for the conversation to load (should not take long)
    // If working correctly, messages should appear
    // If broken, we'll see "Start a conversation" placeholder
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Step 7: Check that messages are displayed
    // The bug causes the page to show the empty state instead of messages
    const emptyState = page.locator('text=Start a conversation');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasEmptyState) {
      // Bug is present - conversation shows empty state
      console.log('❌ BUG DETECTED: Conversation shows empty state instead of messages');

      // Check network requests to debug
      console.log('Current URL:', page.url());

      throw new Error(
        `Conversation "${conversationTitle}" loaded but shows empty chat interface. ` +
        'Expected: Messages should be visible. ' +
        'Actual: "Start a conversation" placeholder is shown.'
      );
    }

    // If we get here, messages should be visible
    // Look for message containers (they use StreamingChatMessage component)
    const messageExists = await page.locator('[role="article"], .message, p').count() > 2;

    expect(messageExists).toBe(true);
    console.log('✅ SUCCESS: Messages loaded correctly');
  });

  test('should make correct API calls when loading conversation', async ({ page }) => {
    // Monitor network requests
    const apiCalls: { url: string; status: number }[] = [];

    page.on('response', response => {
      if (response.url().includes('/api/conversations/')) {
        apiCalls.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Open hamburger menu and click first conversation
    await page.click('[role="button"]:has-text("Open navigation menu")');
    await page.waitForSelector('[role="dialog"]');

    const firstConversation = page.locator('[role="dialog"] button').filter({
      has: page.locator('p:has-text(" ago")')
    }).first();
    await firstConversation.click();

    // Wait for page to load
    await page.waitForURL(/\/chat\/[a-f0-9-]+/);
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    // Verify API calls were made
    console.log('API calls made:', apiCalls);

    // Should call both conversation details and messages endpoints
    const conversationDetailCalls = apiCalls.filter(call =>
      call.url.match(/\/api\/conversations\/[a-f0-9-]+$/)
    );
    const messagesCalls = apiCalls.filter(call =>
      call.url.includes('/messages')
    );

    expect(conversationDetailCalls.length).toBeGreaterThan(0);
    expect(messagesCalls.length).toBeGreaterThan(0);

    // All calls should succeed (200 OK)
    const failedCalls = apiCalls.filter(call => call.status !== 200);
    expect(failedCalls).toHaveLength(0);
  });
});
