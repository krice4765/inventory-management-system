/**
 * Custom Error Classes and Error Handling Utilities
 *
 * Provides a unified error handling system across the application
 */

/**
 * Base API Error class for all application errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Database-related errors (Supabase PostgrestError)
 */
export class DatabaseError extends ApiError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, code, 500, details);
    this.name = 'DatabaseError';
  }
}

/**
 * Authentication-related errors
 */
export class AuthError extends ApiError {
  constructor(message: string, code?: string) {
    super(message, code, 401);
    this.name = 'AuthError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends ApiError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400, fields);
    this.name = 'ValidationError';
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'リソースが見つかりません') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends ApiError {
  constructor(message: string = 'ネットワークエラーが発生しました') {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
  }
}

/**
 * Type guard to check if error is a Supabase PostgrestError
 */
function isPostgrestError(error: unknown): error is { code: string; message: string; details?: string; hint?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Type guard to check if error is a Supabase AuthError
 */
function isSupabaseAuthError(error: unknown): error is { message: string; status?: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

/**
 * Error code to user-friendly message mapping
 */
const ERROR_MESSAGES: Record<string, string> = {
  // PostgreSQL error codes
  '23505': '重複したデータが存在します',
  '23503': '関連するデータが存在しないため、操作できません',
  '23502': '必須項目が入力されていません',
  '42P01': 'テーブルが見つかりません',
  '42703': 'カラムが見つかりません',

  // Supabase error codes
  'PGRST116': 'データが見つかりません',
  'PGRST301': '権限がありません',

  // Custom error codes
  'NETWORK_ERROR': 'ネットワークエラーが発生しました。インターネット接続を確認してください',
  'VALIDATION_ERROR': '入力内容に誤りがあります',
  'NOT_FOUND': 'データが見つかりません',
  'UNAUTHORIZED': '認証が必要です',
  'FORBIDDEN': 'この操作を実行する権限がありません',
};

/**
 * Convert unknown error to ApiError
 */
export function handleApiError(error: unknown): ApiError {
  // Already an ApiError
  if (error instanceof ApiError) {
    return error;
  }

  // Supabase PostgrestError
  if (isPostgrestError(error)) {
    const message = ERROR_MESSAGES[error.code] || error.message || 'データベースエラーが発生しました';
    return new DatabaseError(message, error.code, {
      details: error.details,
      hint: error.hint,
    });
  }

  // Supabase AuthError
  if (isSupabaseAuthError(error)) {
    const status = (error as any).status;
    if (status === 401 || status === 403) {
      return new AuthError(error.message || '認証エラーが発生しました');
    }
    return new ApiError(error.message || '認証エラーが発生しました', 'AUTH_ERROR', status);
  }

  // Standard Error
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return new NetworkError();
    }
    return new ApiError(error.message || '予期しないエラーが発生しました');
  }

  // Unknown error type
  return new ApiError('予期しないエラーが発生しました', 'UNKNOWN_ERROR', 500, error);
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  const apiError = handleApiError(error);

  // Check if we have a predefined message for this error code
  if (apiError.code && ERROR_MESSAGES[apiError.code]) {
    return ERROR_MESSAGES[apiError.code];
  }

  return apiError.message;
}

/**
 * Log error to console (can be extended to send to error tracking service)
 */
export function logError(error: unknown, context?: string): void {
  const apiError = handleApiError(error);

  console.error('[Error]', {
    context,
    name: apiError.name,
    message: apiError.message,
    code: apiError.code,
    statusCode: apiError.statusCode,
    details: apiError.details,
    stack: apiError.stack,
  });

  // TODO: Send to error tracking service (e.g., Sentry)
  // if (import.meta.env.PROD) {
  //   Sentry.captureException(apiError, {
  //     tags: { context },
  //   });
  // }
}

/**
 * Check if error is retryable (network errors, timeouts, etc.)
 */
export function isRetryableError(error: unknown): boolean {
  const apiError = handleApiError(error);

  return (
    apiError instanceof NetworkError ||
    apiError.statusCode === 408 || // Request Timeout
    apiError.statusCode === 429 || // Too Many Requests
    apiError.statusCode === 503 || // Service Unavailable
    apiError.statusCode === 504    // Gateway Timeout
  );
}

/**
 * Check if error indicates authentication is required
 */
export function isAuthError(error: unknown): boolean {
  const apiError = handleApiError(error);
  return apiError instanceof AuthError || apiError.statusCode === 401 || apiError.statusCode === 403;
}
