import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  DatabaseError,
  AuthError,
  ValidationError,
  NotFoundError,
  NetworkError,
  handleApiError,
  getErrorMessage,
  logError,
  isRetryableError,
  isAuthError,
} from './errors';

describe('errors', () => {
  describe('ApiError', () => {
    it('should create an ApiError with all properties', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 500, { foo: 'bar' });

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.name).toBe('ApiError');
    });

    it('should work with minimal parameters', () => {
      const error = new ApiError('Simple error');

      expect(error.message).toBe('Simple error');
      expect(error.code).toBeUndefined();
      expect(error.statusCode).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    it('should capture stack trace', () => {
      const error = new ApiError('Test error');
      expect(error.stack).toBeDefined();
    });
  });

  describe('DatabaseError', () => {
    it('should create a DatabaseError with correct defaults', () => {
      const error = new DatabaseError('DB error', '23505', { table: 'users' });

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('DB error');
      expect(error.code).toBe('23505');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ table: 'users' });
      expect(error.name).toBe('DatabaseError');
    });
  });

  describe('AuthError', () => {
    it('should create an AuthError with correct defaults', () => {
      const error = new AuthError('Auth failed', 'INVALID_TOKEN');

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Auth failed');
      expect(error.code).toBe('INVALID_TOKEN');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthError');
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with field errors', () => {
      const fields = { email: 'Invalid email', password: 'Too short' };
      const error = new ValidationError('Validation failed', fields);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.fields).toEqual(fields);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with default message', () => {
      const error = new NotFoundError();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('リソースが見つかりません');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });

    it('should create a NotFoundError with custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.message).toBe('User not found');
    });
  });

  describe('NetworkError', () => {
    it('should create a NetworkError with default message', () => {
      const error = new NetworkError();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('ネットワークエラーが発生しました');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBe(0);
      expect(error.name).toBe('NetworkError');
    });

    it('should create a NetworkError with custom message', () => {
      const error = new NetworkError('Connection timeout');

      expect(error.message).toBe('Connection timeout');
    });
  });

  describe('handleApiError', () => {
    it('should return ApiError as-is', () => {
      const original = new ApiError('Test', 'CODE', 500);
      const result = handleApiError(original);

      expect(result).toBe(original);
    });

    it('should convert PostgrestError to DatabaseError', () => {
      const postgrestError = {
        code: '23505',
        message: 'Duplicate key',
        details: 'Key already exists',
        hint: 'Use UPDATE instead',
      };

      const result = handleApiError(postgrestError);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('重複したデータが存在します');
      expect(result.code).toBe('23505');
    });

    it('should convert unknown PostgrestError code to DatabaseError', () => {
      const postgrestError = {
        code: 'UNKNOWN_CODE',
        message: 'Unknown error',
      };

      const result = handleApiError(postgrestError);

      expect(result).toBeInstanceOf(DatabaseError);
      expect(result.message).toBe('Unknown error');
    });

    it('should convert Supabase AuthError with 401 status', () => {
      const authError = {
        message: 'Invalid credentials',
        status: 401,
      };

      const result = handleApiError(authError);

      expect(result).toBeInstanceOf(AuthError);
      expect(result.message).toBe('Invalid credentials');
    });

    it('should convert Supabase AuthError with 403 status', () => {
      const authError = {
        message: 'Forbidden',
        status: 403,
      };

      const result = handleApiError(authError);

      expect(result).toBeInstanceOf(AuthError);
      expect(result.message).toBe('Forbidden');
    });

    it('should convert Error to ApiError (due to isSupabaseAuthError catching all Errors)', () => {
      // Note: isSupabaseAuthError checks for 'message' property, which Error has,
      // so it intercepts all Error instances before the network error check
      const error = new Error('Something went wrong');
      const result = handleApiError(error);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe('Something went wrong');
    });

    it('should handle Error with status property as auth error', () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;
      const result = handleApiError(error);

      expect(result).toBeInstanceOf(AuthError);
      expect(result.message).toBe('Unauthorized');
    });

    it('should handle unknown error types', () => {
      const result = handleApiError('string error');

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe('予期しないエラーが発生しました');
      expect(result.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('getErrorMessage', () => {
    it('should return predefined message for known error codes', () => {
      const error = new DatabaseError('DB error', '23505');
      const message = getErrorMessage(error);

      expect(message).toBe('重複したデータが存在します');
    });

    it('should return error message for unknown codes', () => {
      const error = new ApiError('Custom error', 'CUSTOM_CODE');
      const message = getErrorMessage(error);

      expect(message).toBe('Custom error');
    });

    it('should handle non-ApiError input', () => {
      const message = getErrorMessage(new Error('Test error'));

      expect(message).toBe('Test error');
    });
  });

  describe('logError', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should log error to console', () => {
      const error = new ApiError('Test error', 'TEST', 500);

      logError(error, 'test-context');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Error]', {
        context: 'test-context',
        name: 'ApiError',
        message: 'Test error',
        code: 'TEST',
        statusCode: 500,
        details: undefined,
        stack: expect.any(String),
      });
    });

    it('should log error without context', () => {
      const error = new Error('Test error');

      logError(error);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('isRetryableError', () => {
    it('should return true for NetworkError', () => {
      const error = new NetworkError();
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 408 (Request Timeout)', () => {
      const error = new ApiError('Timeout', 'TIMEOUT', 408);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 429 (Too Many Requests)', () => {
      const error = new ApiError('Rate limit', 'RATE_LIMIT', 429);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 503 (Service Unavailable)', () => {
      const error = new ApiError('Service down', 'SERVICE_DOWN', 503);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 504 (Gateway Timeout)', () => {
      const error = new ApiError('Gateway timeout', 'GATEWAY_TIMEOUT', 504);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new ValidationError('Validation error');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 500 errors', () => {
      const error = new DatabaseError('DB error');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for AuthError', () => {
      const error = new AuthError('Auth failed');
      expect(isAuthError(error)).toBe(true);
    });

    it('should return true for 401 status', () => {
      const error = new ApiError('Unauthorized', 'UNAUTHORIZED', 401);
      expect(isAuthError(error)).toBe(true);
    });

    it('should return true for 403 status', () => {
      const error = new ApiError('Forbidden', 'FORBIDDEN', 403);
      expect(isAuthError(error)).toBe(true);
    });

    it('should return false for non-auth errors', () => {
      const error = new ValidationError('Validation error');
      expect(isAuthError(error)).toBe(false);
    });

    it('should return false for 500 errors', () => {
      const error = new DatabaseError('DB error');
      expect(isAuthError(error)).toBe(false);
    });
  });

  describe('ERROR_MESSAGES mapping', () => {
    it('should map PostgreSQL duplicate key error', () => {
      const error = { code: '23505', message: 'duplicate key' };
      const message = getErrorMessage(error);
      expect(message).toBe('重複したデータが存在します');
    });

    it('should map PostgreSQL foreign key error', () => {
      const error = { code: '23503', message: 'foreign key violation' };
      const message = getErrorMessage(error);
      expect(message).toBe('関連するデータが存在しないため、操作できません');
    });

    it('should map PostgreSQL not null error', () => {
      const error = { code: '23502', message: 'not null violation' };
      const message = getErrorMessage(error);
      expect(message).toBe('必須項目が入力されていません');
    });

    it('should map Supabase PGRST116 error', () => {
      const error = { code: 'PGRST116', message: 'not found' };
      const message = getErrorMessage(error);
      expect(message).toBe('データが見つかりません');
    });

    it('should map Supabase PGRST301 error', () => {
      const error = { code: 'PGRST301', message: 'permission denied' };
      const message = getErrorMessage(error);
      expect(message).toBe('権限がありません');
    });
  });
});
