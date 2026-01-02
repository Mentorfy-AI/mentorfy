import { describe, it, expect } from 'vitest';
import {
  determineAuthStrategy,
  maskEmail,
  maskPhone,
  formatPhoneE164,
  type UserAccountInfo,
} from './check-account-logic';

describe('determineAuthStrategy', () => {
  describe('NEW_SIGNUP - Neither email nor phone exist', () => {
    it('returns NEW_SIGNUP when no accounts exist and no whitelist', () => {
      const result = determineAuthStrategy({
        emailUser: null,
        phoneUser: null,
        orgHasWhitelist: false,
      });

      expect(result.strategy).toBe('NEW_SIGNUP');
      expect(result.userId).toBeUndefined();
      expect(result.maskedPhone).toBeUndefined();
      expect(result.maskedEmail).toBeUndefined();
    });

    it('returns NEW_SIGNUP when no accounts exist even if org has whitelist', () => {
      const result = determineAuthStrategy({
        emailUser: null,
        phoneUser: null,
        orgHasWhitelist: true,
      });

      // Whitelist is checked before this function is called, so if we get here
      // the email is already allowed. We just do normal NEW_SIGNUP flow.
      expect(result.strategy).toBe('NEW_SIGNUP');
      expect(result.userId).toBeUndefined();
      expect(result.maskedPhone).toBeUndefined();
      expect(result.maskedEmail).toBeUndefined();
    });
  });

  describe('PHONE_SIGNIN - Email exists with phone', () => {
    it('returns PHONE_SIGNIN when email user has phone', () => {
      const emailUser: UserAccountInfo = {
        id: 'user_123',
        hasPhone: true,
        phoneNumber: '+15551234567',
        emailAddress: 'test@example.com',
      };

      const result = determineAuthStrategy({
        emailUser,
        phoneUser: null,
        orgHasWhitelist: false,
      });

      expect(result.strategy).toBe('PHONE_SIGNIN');
      expect(result.userId).toBe('user_123');
      expect(result.maskedPhone).toBe('***-***-4567');
    });

    it('returns PHONE_SIGNIN even when phone also matches (same account)', () => {
      const user: UserAccountInfo = {
        id: 'user_123',
        hasPhone: true,
        phoneNumber: '+15551234567',
        emailAddress: 'test@example.com',
      };

      const result = determineAuthStrategy({
        emailUser: user,
        phoneUser: user, // Same user found by both email and phone
        orgHasWhitelist: false,
      });

      expect(result.strategy).toBe('PHONE_SIGNIN');
      expect(result.userId).toBe('user_123');
    });
  });

  describe('MAGIC_LINK - Email exists without phone', () => {
    it('returns MAGIC_LINK when email user has no phone', () => {
      const emailUser: UserAccountInfo = {
        id: 'user_456',
        hasPhone: false,
        emailAddress: 'nophone@example.com',
      };

      const result = determineAuthStrategy({
        emailUser,
        phoneUser: null,
        orgHasWhitelist: false,
      });

      expect(result.strategy).toBe('MAGIC_LINK');
      expect(result.userId).toBe('user_456');
      expect(result.maskedPhone).toBeUndefined();
    });

    it('returns MAGIC_LINK when email user has no phone even if phone exists on different account', () => {
      const emailUser: UserAccountInfo = {
        id: 'user_email',
        hasPhone: false,
        emailAddress: 'alice@example.com',
      };

      const phoneUser: UserAccountInfo = {
        id: 'user_phone',
        hasPhone: true,
        phoneNumber: '+15559999999',
        emailAddress: 'bob@example.com',
      };

      // Email takes precedence - we sign in the email user
      const result = determineAuthStrategy({
        emailUser,
        phoneUser,
        orgHasWhitelist: false,
      });

      expect(result.strategy).toBe('MAGIC_LINK');
      expect(result.userId).toBe('user_email');
    });
  });

  describe('PHONE_CONFLICT - Phone exists but email does not', () => {
    it('returns PHONE_CONFLICT when only phone exists', () => {
      const phoneUser: UserAccountInfo = {
        id: 'user_789',
        hasPhone: true,
        phoneNumber: '+15551234567',
        emailAddress: 'existing@example.com',
      };

      const result = determineAuthStrategy({
        emailUser: null,
        phoneUser,
        orgHasWhitelist: false,
      });

      expect(result.strategy).toBe('PHONE_CONFLICT');
      expect(result.userId).toBe('user_789');
      expect(result.maskedEmail).toBe('e***g@example.com');
    });

    it('handles phone user without email address', () => {
      const phoneUser: UserAccountInfo = {
        id: 'user_orphan',
        hasPhone: true,
        phoneNumber: '+15551234567',
        // No email address
      };

      const result = determineAuthStrategy({
        emailUser: null,
        phoneUser,
        orgHasWhitelist: false,
      });

      expect(result.strategy).toBe('PHONE_CONFLICT');
      expect(result.userId).toBe('user_orphan');
      expect(result.maskedEmail).toBeUndefined();
    });
  });

  describe('Email precedence over phone', () => {
    it('prioritizes email match when email and phone belong to different accounts', () => {
      const emailUser: UserAccountInfo = {
        id: 'user_alice',
        hasPhone: true,
        phoneNumber: '+15551111111',
        emailAddress: 'alice@example.com',
      };

      const phoneUser: UserAccountInfo = {
        id: 'user_bob',
        hasPhone: true,
        phoneNumber: '+15552222222',
        emailAddress: 'bob@example.com',
      };

      // User entered alice's email but bob's phone
      // We should authenticate alice (email precedence)
      const result = determineAuthStrategy({
        emailUser,
        phoneUser,
        orgHasWhitelist: false,
      });

      expect(result.strategy).toBe('PHONE_SIGNIN');
      expect(result.userId).toBe('user_alice'); // Alice's account, not Bob's
      expect(result.maskedPhone).toBe('***-***-1111'); // Alice's phone
    });
  });
});

describe('maskEmail', () => {
  it('masks standard email', () => {
    expect(maskEmail('john.doe@example.com')).toBe('j***e@example.com');
  });

  it('masks short local part', () => {
    expect(maskEmail('jo@example.com')).toBe('j***@example.com');
  });

  it('masks single character local part', () => {
    expect(maskEmail('j@example.com')).toBe('j***@example.com');
  });

  it('handles email without @ symbol', () => {
    expect(maskEmail('invalid')).toBe('invalid');
  });
});

describe('maskPhone', () => {
  it('masks standard US phone', () => {
    expect(maskPhone('+15551234567')).toBe('***-***-4567');
  });

  it('masks phone without country code', () => {
    expect(maskPhone('5551234567')).toBe('***-***-4567');
  });

  it('masks phone with formatting', () => {
    expect(maskPhone('(555) 123-4567')).toBe('***-***-4567');
  });

  it('handles short phone numbers', () => {
    expect(maskPhone('123')).toBe('***');
  });
});

describe('formatPhoneE164', () => {
  it('keeps already formatted E.164 numbers', () => {
    expect(formatPhoneE164('+15551234567')).toBe('+15551234567');
  });

  it('adds +1 prefix to raw digits', () => {
    expect(formatPhoneE164('5551234567')).toBe('+15551234567');
  });

  it('strips formatting and adds +1', () => {
    expect(formatPhoneE164('(555) 123-4567')).toBe('+15551234567');
  });
});

