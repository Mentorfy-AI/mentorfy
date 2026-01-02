/**
 * Pure logic for determining authentication strategy
 * Separated from route handler for testability
 */

import {
  evaluateWhitelistStrategy,
  type WhitelistStrategy,
  type WhitelistResult,
  type StrategyContext,
} from './whitelist-strategies';

export type { WhitelistResult, StrategyContext };

export type AuthStrategy =
  | 'NEW_SIGNUP'
  | 'NEW_SIGNUP_WITH_EMAIL_VERIFICATION'
  | 'PHONE_SIGNIN'
  | 'MAGIC_LINK'
  | 'PHONE_CONFLICT'
  | 'WHITELIST_BLOCKED';

export interface CheckAccountResponse {
  strategy: AuthStrategy;
  userId?: string;
  maskedPhone?: string;
  maskedEmail?: string;
  blockedMessage?: string; // Custom message when WHITELIST_BLOCKED
}

/**
 * Represents a user's account state from Clerk
 */
export interface UserAccountInfo {
  id: string;
  hasPhone: boolean;
  phoneNumber?: string;
  emailAddress?: string;
}

/**
 * Input for the strategy determination
 */
export interface CheckAccountInput {
  emailUser: UserAccountInfo | null;
  phoneUser: UserAccountInfo | null;
  orgHasWhitelist: boolean;
}

/**
 * Determines the authentication strategy based on account state
 *
 * Decision matrix:
 * - Email exists + has phone → PHONE_SIGNIN
 * - Email exists + no phone → MAGIC_LINK
 * - Email doesn't exist + phone exists → PHONE_CONFLICT
 * - Neither exists + org has whitelist → NEW_SIGNUP_WITH_EMAIL_VERIFICATION (must prove email ownership)
 * - Neither exists + no whitelist → NEW_SIGNUP
 */
export function determineAuthStrategy(
  input: CheckAccountInput
): CheckAccountResponse {
  const { emailUser, phoneUser, orgHasWhitelist } = input;

  // Priority 1: Email exists
  if (emailUser) {
    if (emailUser.hasPhone) {
      return {
        strategy: 'PHONE_SIGNIN',
        userId: emailUser.id,
        maskedPhone: emailUser.phoneNumber
          ? maskPhone(emailUser.phoneNumber)
          : undefined,
      };
    } else {
      return {
        strategy: 'MAGIC_LINK',
        userId: emailUser.id,
      };
    }
  }

  // Priority 2: Email doesn't exist, check phone
  if (phoneUser) {
    return {
      strategy: 'PHONE_CONFLICT',
      userId: phoneUser.id,
      maskedEmail: phoneUser.emailAddress
        ? maskEmail(phoneUser.emailAddress)
        : undefined,
    };
  }

  // Priority 3: Neither exists - always use NEW_SIGNUP (SMS verification)
  // Note: NEW_SIGNUP_WITH_EMAIL_VERIFICATION was intended for whitelisted orgs
  // to prevent email hijacking, but Clerk's client-side flow doesn't support
  // email-only verification without also requiring phone verification.
  // The whitelist still blocks unauthorized emails before this point.
  return {
    strategy: 'NEW_SIGNUP',
  };
}

/**
 * Mask email: john.doe@example.com → j***e@example.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;

  const maskedLocal =
    local.length <= 2
      ? local[0] + '***'
      : local[0] + '***' + local[local.length - 1];

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone: +15551234567 → ***-***-4567
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';

  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Format phone to E.164 format.
 * - If already E.164 (starts with +), return as-is
 * - Legacy fallback: assume US (+1) for old 10-digit numbers without country code
 */
export function formatPhoneE164(phone: string): string {
  if (phone.startsWith('+')) {
    return phone;
  }
  // Legacy: assume US for old numbers stored without country code
  return `+1${phone.replace(/\D/g, '')}`;
}

/**
 * Bot settings structure for whitelist
 */
export interface BotWhitelistSettings {
  whitelist_strategy?: WhitelistStrategy | null;
}

/**
 * Check whitelist using the pluggable strategy system.
 * Returns null if no whitelist configured, otherwise returns allow/block result.
 *
 * Async because some strategies (e.g., whop_customer) require network calls.
 *
 * @param email - Email to check
 * @param settings - Bot-level whitelist settings
 * @param context - Optional context with org-level API keys (e.g., whop_api_key)
 */
export async function checkWhitelist(
  email: string,
  settings: BotWhitelistSettings | null,
  context?: StrategyContext
): Promise<WhitelistResult | null> {
  if (!settings?.whitelist_strategy) return null;

  return evaluateWhitelistStrategy(email, settings.whitelist_strategy, context);
}
