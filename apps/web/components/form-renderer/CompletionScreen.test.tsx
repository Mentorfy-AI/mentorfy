import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CompletionScreen } from './CompletionScreen';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock Clerk hooks
vi.mock('@clerk/nextjs', () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      create: vi.fn().mockResolvedValue({
        supportedFirstFactors: [
          { strategy: 'phone_code', phoneNumberId: 'phone_123' },
        ],
      }),
      prepareFirstFactor: vi.fn().mockResolvedValue({}),
      attemptFirstFactor: vi.fn(),
    },
  }),
  useSignUp: () => ({
    isLoaded: true,
    signUp: {
      create: vi.fn().mockResolvedValue({
        preparePhoneNumberVerification: vi.fn().mockResolvedValue({}),
        prepareEmailAddressVerification: vi.fn().mockResolvedValue({}),
      }),
      preparePhoneNumberVerification: vi.fn().mockResolvedValue({}),
      prepareEmailAddressVerification: vi.fn().mockResolvedValue({}),
      attemptPhoneNumberVerification: vi.fn(),
      attemptEmailAddressVerification: vi.fn(),
    },
    setActive: vi.fn(),
  }),
  useAuth: () => ({
    isSignedIn: false,
    userId: null,
  }),
  useClerk: () => ({
    session: null,
  }),
}));

// Mock form theme
vi.mock('@/lib/forms/theme', () => ({
  useFormTheme: () => ({
    primary: '#2B7FFF',
    primaryHover: '#256DD9',
    primaryLight5: 'rgba(43, 127, 255, 0.05)',
    primaryLight10: 'rgba(43, 127, 255, 0.1)',
    primaryLight20: 'rgba(43, 127, 255, 0.2)',
    bgOuter: '#F9FAFB',
    bgContainer: '#FFFFFF',
    textHeading: '#111827',
    textBody: '#374151',
    textSubtle: '#6B7280',
    textMuted: '#9CA3AF',
    borderLight: '#E5E7EB',
    error: '#DC2626',
    errorBg: '#FEF2F2',
  }),
}));

const defaultProps = {
  profile: {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    phone: '5551234567',
  },
  submissionId: 'sub_123',
  botId: 'bot_123',
  orgId: 'org_123',
};

function mockFetchResponse(response: object) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(response),
  });
}

describe('CompletionScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renders correct UI for each auth strategy', () => {
    it('NEW_SIGNUP → shows "Check your phone"', async () => {
      mockFetchResponse({ strategy: 'NEW_SIGNUP' });

      render(<CompletionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Check your phone')).toBeInTheDocument();
      });
    });

    it('NEW_SIGNUP_WITH_EMAIL_VERIFICATION → shows "Check your email"', async () => {
      mockFetchResponse({ strategy: 'NEW_SIGNUP_WITH_EMAIL_VERIFICATION' });

      render(<CompletionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });

    it('PHONE_SIGNIN → shows "Check your phone"', async () => {
      mockFetchResponse({
        strategy: 'PHONE_SIGNIN',
        userId: 'user_123',
        maskedPhone: '***-***-4567',
      });

      render(<CompletionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Check your phone')).toBeInTheDocument();
      });
    });

    it('MAGIC_LINK → shows "Check Your Email" with magic link message', async () => {
      mockFetchResponse({
        strategy: 'MAGIC_LINK',
        userId: 'user_123',
      });

      render(<CompletionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Check Your Email')).toBeInTheDocument();
        expect(screen.getByText(/sign-in link/i)).toBeInTheDocument();
      });
    });

    it('PHONE_CONFLICT → shows "Phone Already Registered" with masked email', async () => {
      mockFetchResponse({
        strategy: 'PHONE_CONFLICT',
        userId: 'user_123',
        maskedEmail: 't***t@example.com',
      });

      render(<CompletionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Phone Already Registered')).toBeInTheDocument();
        expect(screen.getByText('t***t@example.com')).toBeInTheDocument();
      });
    });

    it('WHITELIST_BLOCKED → shows "Access Restricted"', async () => {
      mockFetchResponse({
        strategy: 'WHITELIST_BLOCKED',
        blockedMessage: 'Only enrolled students can access this mentor.',
      });

      render(<CompletionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Access Restricted')).toBeInTheDocument();
        expect(
          screen.getByText('Only enrolled students can access this mentor.')
        ).toBeInTheDocument();
      });
    });

    it('WHITELIST_BLOCKED → shows default message when no custom message provided', async () => {
      mockFetchResponse({
        strategy: 'WHITELIST_BLOCKED',
      });

      render(<CompletionScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Access Restricted')).toBeInTheDocument();
        expect(
          screen.getByText(/don't have access to this AI mentor/i)
        ).toBeInTheDocument();
      });
    });
  });
});
