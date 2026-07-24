/** Cookie name for the session token. */
export const SESSION_COOKIE_NAME = 'derlist_session';

/** Session lifetime: 30 days in milliseconds. */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Sliding window threshold: if the session has less than 15 days remaining,
 * extend it back to 30 days. This keeps active users logged in without
 * requiring re-authentication.
 */
export const SESSION_REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;

/** Token length in bytes (32 bytes = 256 bits of entropy). */
export const TOKEN_BYTE_LENGTH = 32;
