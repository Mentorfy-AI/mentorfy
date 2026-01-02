/**
 * Pluggable whitelist strategy system
 *
 * Supports multiple strategy types for controlling access to mentor bots:
 * - email_list: Static list of allowed email addresses
 * - whop_customer: Check Whop API for paid membership
 */

export type WhitelistStrategyType = 'email_list' | 'whop_customer';

export interface EmailListStrategy {
  type: 'email_list';
  emails: string[];
  blockedMessage?: string;
}

export interface WhopCustomerStrategy {
  type: 'whop_customer';
  companyId: string; // biz_xxxxxxxxxxxxxx
  productIds?: string[]; // Optional: filter to specific products
  blockedMessage?: string;
}

export type WhitelistStrategy = EmailListStrategy | WhopCustomerStrategy;

export interface WhitelistResult {
  allowed: boolean;
  blockedMessage?: string;
}

/**
 * Context for evaluating strategies that need external resources
 */
export interface StrategyContext {
  whopApiKey?: string; // Per-org Whop API key from organization.settings
}

/**
 * Main evaluation function for whitelist strategies.
 * Async to support network-based strategies like Whop.
 */
export async function evaluateWhitelistStrategy(
  email: string,
  strategy: WhitelistStrategy,
  context?: StrategyContext
): Promise<WhitelistResult> {
  switch (strategy.type) {
    case 'email_list':
      return evaluateEmailList(email, strategy);
    case 'whop_customer':
      return evaluateWhopCustomer(email, strategy, context);
    default:
      // Unknown strategy type - allow access (graceful degradation)
      console.warn('[WHITELIST] Unknown strategy type:', (strategy as any).type);
      return { allowed: true };
  }
}

function evaluateEmailList(
  email: string,
  strategy: EmailListStrategy
): WhitelistResult {
  const normalized = email.toLowerCase().trim();
  const allowed = strategy.emails.some(
    (e) => e.toLowerCase().trim() === normalized
  );
  return {
    allowed,
    blockedMessage: allowed ? undefined : strategy.blockedMessage,
  };
}

async function evaluateWhopCustomer(
  email: string,
  strategy: WhopCustomerStrategy,
  context?: StrategyContext
): Promise<WhitelistResult> {
  const isPaid = await checkWhopMembership(
    email,
    strategy.companyId,
    strategy.productIds,
    context?.whopApiKey
  );
  return {
    allowed: isPaid,
    blockedMessage: isPaid ? undefined : strategy.blockedMessage,
  };
}

/**
 * Check Whop API for customer membership.
 * Uses the List Members endpoint with email query.
 *
 * API key is passed from organization.settings.whop_api_key - each org has their own Whop account.
 *
 * @see https://docs.whop.com/api-reference/members/list
 */
async function checkWhopMembership(
  email: string,
  companyId: string,
  productIds?: string[],
  apiKey?: string
): Promise<boolean> {
  if (!apiKey) {
    console.error('[WHOP] Missing whop_api_key in organization settings - failing closed');
    return false; // Fail closed - no access if misconfigured
  }

  const url = new URL('https://api.whop.com/api/v1/members');
  url.searchParams.set('company_id', companyId);
  url.searchParams.set('query', email);
  if (productIds?.length) {
    productIds.forEach((id) => url.searchParams.append('product_ids', id));
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[WHOP] API error:', res.status, errorText);
      return false; // Fail closed
    }

    const data = await res.json();

    // Check if any member matches the email AND has customer access
    for (const member of data.data || []) {
      if (
        member.user?.email?.toLowerCase() === email.toLowerCase() &&
        member.access_level === 'customer'
      ) {
        console.log('[WHOP] Customer verified:', email);
        return true;
      }
    }

    console.log('[WHOP] No valid membership found for:', email);
    return false;
  } catch (error) {
    console.error('[WHOP] Network error:', error);
    return false; // Fail closed on network errors
  }
}
