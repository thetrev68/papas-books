/**
 * Application-wide constants
 *
 * This file centralizes magic numbers used throughout the application
 * to improve maintainability and make values easier to update.
 */

// Authentication timeouts and retries
export const AUTH_TIMEOUT_MS = 8000;
export const AUTH_RETRY_DELAY_MS = 500;

// Toast notification durations (milliseconds)
export const TOAST_DURATION_ERROR_MS = 5000;
export const TOAST_DURATION_SUCCESS_MS = 3000;
export const TOAST_DURATION_INFO_MS = 4000;
export const TOAST_DURATION_WARNING_MS = 4000;

// Supabase query batch sizes
export const SUPABASE_BATCH_SIZE = 100;

// Currency conversion
export const CENTS_PER_DOLLAR = 100;

// Validation limits
export const MAX_PATTERN_LENGTH = 500;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_NAME_LENGTH = 100;
export const MAX_PRIORITY = 100;
export const MIN_PRIORITY = 1;
