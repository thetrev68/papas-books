/**
 * Sentry Error Monitoring Configuration
 *
 * Initializes Sentry for production error tracking.
 * Only active when VITE_SENTRY_DSN environment variable is set.
 */
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry error monitoring.
 * Call this at app startup before React renders.
 */
export function initSentry(): void {
  // Only initialize if DSN is configured (production)
  if (!SENTRY_DSN) {
    if (import.meta.env.DEV) {
      console.log('[Sentry] DSN not configured, error tracking disabled');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,

    // Performance monitoring sample rate (adjust based on traffic)
    tracesSampleRate: 0.1,

    // Session replay for debugging (captures 10% of sessions, 100% on error)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Filter out known non-actionable errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Ignore network errors that are often transient
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
    },

    // Don't send PII
    sendDefaultPii: false,
  });
}

/**
 * Capture an exception manually.
 * Use this in catch blocks for important errors.
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) {
    console.error('[Error]', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Set user context for error tracking.
 * Call this after user authentication.
 */
export function setUser(userId: string, email?: string): void {
  if (!SENTRY_DSN) return;

  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Clear user context on logout.
 */
export function clearUser(): void {
  if (!SENTRY_DSN) return;

  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging.
 * Breadcrumbs help trace what happened before an error.
 *
 * NOTE: Exported for future use (optional utility for debugging complex flows).
 * Not currently used but provides value for production debugging when needed.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Re-export Sentry's ErrorBoundary for use with React.
 *
 * NOTE: Exported for future use. Currently using custom ErrorBoundary
 * (src/components/ErrorBoundary.tsx) which integrates with Sentry via
 * captureException() and provides consistent UI with app design.
 */
export { ErrorBoundary as SentryErrorBoundary } from '@sentry/react';
