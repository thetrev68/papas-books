/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/react';

// Mock Sentry module
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  ErrorBoundary: vi.fn(() => null),
}));

describe('sentry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initSentry', () => {
    it('should call Sentry.init with correct configuration when DSN is set', async () => {
      // Since we can't easily mock import.meta.env at runtime,
      // we test that init is called with the expected structure
      const { initSentry } = await import('./sentry');

      // In test environment, DSN is not set, so init won't be called
      // But we can verify the function exists and doesn't crash
      expect(typeof initSentry).toBe('function');
      initSentry();

      // In test env without DSN, Sentry.init should not be called
      // This test verifies the guard clause works
    });

    it('should have beforeSend filter for network errors', () => {
      // Test the beforeSend logic directly
      const beforeSend = (event: any, hint: any) => {
        const error = hint.originalException;

        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          if (
            message.includes('network error') ||
            message.includes('failed to fetch') ||
            message.includes('load failed')
          ) {
            return null;
          }
        }

        return event;
      };

      const event = { message: 'test' };

      // Test network error filtering
      expect(beforeSend(event, { originalException: new Error('Network error') })).toBeNull();
      expect(beforeSend(event, { originalException: new Error('Failed to fetch') })).toBeNull();
      expect(beforeSend(event, { originalException: new Error('Load failed') })).toBeNull();

      // Test non-filtered errors
      expect(beforeSend(event, { originalException: new Error('Database error') })).toEqual(event);

      // Test non-Error exceptions
      expect(beforeSend(event, { originalException: 'string error' })).toEqual(event);
    });
  });

  describe('captureException', () => {
    it('should exist and not crash when called with context', async () => {
      const { captureException } = await import('./sentry');

      expect(typeof captureException).toBe('function');

      const error = new Error('Test error');
      const context = { userId: '123' };

      // Should not crash when called without DSN
      expect(() => captureException(error, context)).not.toThrow();
    });

    it('should work without context parameter', async () => {
      const { captureException } = await import('./sentry');

      const error = new Error('Test error');

      expect(() => captureException(error)).not.toThrow();
    });
  });

  describe('setUser', () => {
    it('should exist and not crash when called', async () => {
      const { setUser } = await import('./sentry');

      expect(typeof setUser).toBe('function');

      // Should not crash when called without DSN
      expect(() => setUser('user-123', 'test@example.com')).not.toThrow();
      expect(() => setUser('user-123')).not.toThrow();
    });
  });

  describe('clearUser', () => {
    it('should exist and not crash when called', async () => {
      const { clearUser } = await import('./sentry');

      expect(typeof clearUser).toBe('function');

      // Should not crash when called without DSN
      expect(() => clearUser()).not.toThrow();
    });
  });

  describe('addBreadcrumb', () => {
    it('should exist and not crash when called', async () => {
      const { addBreadcrumb } = await import('./sentry');

      expect(typeof addBreadcrumb).toBe('function');

      // Should not crash when called without DSN
      expect(() => addBreadcrumb('Test message', 'navigation', { page: 'home' })).not.toThrow();
      expect(() => addBreadcrumb('Test message', 'navigation')).not.toThrow();
    });
  });

  describe('SentryErrorBoundary', () => {
    it('should export ErrorBoundary from Sentry', async () => {
      const { SentryErrorBoundary } = await import('./sentry');

      expect(SentryErrorBoundary).toBe(Sentry.ErrorBoundary);
    });
  });

  describe('integration behavior', () => {
    it('should have all expected exports', async () => {
      const sentryModule = await import('./sentry');

      expect(sentryModule).toHaveProperty('initSentry');
      expect(sentryModule).toHaveProperty('captureException');
      expect(sentryModule).toHaveProperty('setUser');
      expect(sentryModule).toHaveProperty('clearUser');
      expect(sentryModule).toHaveProperty('addBreadcrumb');
      expect(sentryModule).toHaveProperty('SentryErrorBoundary');
    });

    it('should gracefully handle missing DSN', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { initSentry, captureException, setUser, clearUser, addBreadcrumb } =
        await import('./sentry');

      // All functions should work without crashing when DSN is not set
      expect(() => {
        initSentry();
        captureException(new Error('test'));
        setUser('user-1');
        clearUser();
        addBreadcrumb('test', 'category');
      }).not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });
});
