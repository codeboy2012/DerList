/**
 * Structured Import Logging
 *
 * Provides consistent, searchable log entries for the product identification pipeline.
 * NEVER logs secrets, API keys, session tokens, or encrypted credentials.
 */

type ImportLogEvent =
  | 'IMPORT_STARTED'
  | 'AMAZON_ASIN_EXTRACTED'
  | 'DIRECT_EXTRACTION_ATTEMPTED'
  | 'DIRECT_EXTRACTION_FAILED'
  | 'DIRECT_EXTRACTION_BLOCKED'
  | 'DIRECT_EXTRACTION_SUCCEEDED'
  | 'SEARCH_STARTED'
  | 'SEARCH_SKIPPED'
  | 'SEARCH_RESULT_FOUND'
  | 'SEARCH_RESULT_REJECTED'
  | 'SEARCH_NO_RESULTS'
  | 'SEARCH_ERROR'
  | 'AI_IDENTIFICATION_STARTED'
  | 'AI_IDENTIFICATION_COMPLETED'
  | 'AI_SKIPPED'
  | 'AI_PARSE_FAILED'
  | 'AI_TITLE_INVALID'
  | 'AI_ERROR'
  | 'VALIDATION_PASSED'
  | 'VALIDATION_FAILED'
  | 'PRODUCT_IDENTIFIED'
  | 'PRODUCT_NEEDS_REVIEW'
  | 'PRODUCT_IDENTIFICATION_FAILED'
  | 'PIPELINE_COMPLETE';

/**
 * Log a structured import event.
 * Safe to call in production — never includes secrets.
 */
export function importLog(event: ImportLogEvent, data?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...sanitizeLogData(data),
  };

  // Use structured JSON logging in production
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry));
  } else {
    // Dev-friendly format
    const dataStr = data ? ' ' + JSON.stringify(sanitizeLogData(data)) : '';
    console.log(`[import] ${event}${dataStr}`);
  }
}

/**
 * Strip any potentially sensitive data from log entries.
 */
function sanitizeLogData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = new Set([
    'apiKey', 'api_key', 'key', 'secret', 'token', 'password',
    'authorization', 'auth', 'cookie', 'session', 'credential',
    'encryptedConfig', 'configIv', 'configAuthTag',
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = value.substring(0, 500) + '...[truncated]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
