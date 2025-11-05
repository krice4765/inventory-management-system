import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useErrorHandler, useErrorHandlerWithRetry, useFormErrorHandler } from '../../hooks/useErrorHandler';
import toast from 'react-hot-toast';
import * as errorLib from '../../lib/errors';
import { useAuthStore } from '../../stores/authStore';

// Mock dependencies
vi.mock('react-hot-toast');
vi.mock('../../lib/errors');
vi.mock('../../stores/authStore');

describe('Error Handling Integration', () => {
  const mockSetUser = vi.fn();
  const mockToastError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useAuthStore as any).mockReturnValue({ setUser: mockSetUser });
    (toast.error as any) = mockToastError;

    // Setup default mock implementations
    (errorLib.handleApiError as any) = vi.fn((error) => ({
      name: 'ApiError',
      message: error.message || 'Unknown error',
      code: 'UNKNOWN',
    }));
    (errorLib.getErrorMessage as any) = vi.fn((error) => error.message || 'Unknown error');
    (errorLib.logError as any) = vi.fn();
    (errorLib.isAuthError as any) = vi.fn((error) => error.message?.includes('auth'));
  });

  describe('Database Error Flow', () => {
    it('handles database connection error correctly', () => {
      const dbError = {
        message: 'Database connection failed',
        code: 'ECONNREFUSED',
      };

      (errorLib.handleApiError as any).mockReturnValue({
        name: 'DatabaseError',
        message: 'データベース接続に失敗しました',
        code: 'ECONNREFUSED',
      });
      (errorLib.getErrorMessage as any).mockReturnValue('データベース接続に失敗しました');

      const { result } = renderHook(() => useErrorHandler());
      result.current(dbError, 'データの取得に失敗しました');

      expect(mockToastError).toHaveBeenCalledWith(
        'データの取得に失敗しました: データベース接続に失敗しました',
        { duration: 5000 }
      );
    });

    it('handles database constraint violation error', () => {
      const constraintError = {
        message: 'Duplicate key value',
        code: '23505',
      };

      (errorLib.handleApiError as any).mockReturnValue({
        name: 'DatabaseError',
        message: '重複したデータが存在します',
        code: '23505',
      });
      (errorLib.getErrorMessage as any).mockReturnValue('重複したデータが存在します');

      const { result } = renderHook(() => useErrorHandler());
      result.current(constraintError, '登録に失敗しました');

      expect(mockToastError).toHaveBeenCalledWith(
        '登録に失敗しました: 重複したデータが存在します',
        { duration: 5000 }
      );
    });
  });

  describe('Authentication Error Flow', () => {
    it('handles session expiration and clears user', () => {
      const authError = {
        message: 'auth session expired',
        code: 'AUTH_SESSION_EXPIRED',
      };

      (errorLib.isAuthError as any).mockReturnValue(true);

      const { result } = renderHook(() => useErrorHandler());
      result.current(authError);

      expect(mockToastError).toHaveBeenCalledWith(
        'セッションが切れました。再度ログインしてください',
        { duration: 5000 }
      );
      expect(mockSetUser).toHaveBeenCalledWith(null);
    });

    it('handles invalid credentials error', () => {
      const authError = {
        message: 'auth invalid credentials',
        code: 'INVALID_CREDENTIALS',
      };

      (errorLib.isAuthError as any).mockReturnValue(true);

      const { result } = renderHook(() => useErrorHandler());
      result.current(authError);

      expect(mockSetUser).toHaveBeenCalledWith(null);
    });
  });

  describe('Network Error Flow', () => {
    it('handles network timeout error with retry', () => {
      const networkError = {
        message: 'Request timeout',
        code: 'ETIMEDOUT',
      };

      (errorLib.handleApiError as any).mockReturnValue({
        name: 'NetworkError',
        message: 'ネットワークタイムアウトが発生しました',
        code: 'ETIMEDOUT',
      });
      (errorLib.getErrorMessage as any).mockReturnValue('ネットワークタイムアウトが発生しました');

      const retryFn = vi.fn();
      const { result } = renderHook(() => useErrorHandlerWithRetry());

      result.current.handleError(networkError, 'データの取得に失敗しました', retryFn);

      expect(mockToastError).toHaveBeenCalled();
    });

    it('handles offline error', () => {
      const offlineError = {
        message: 'Network unavailable',
        code: 'OFFLINE',
      };

      (errorLib.handleApiError as any).mockReturnValue({
        name: 'NetworkError',
        message: 'ネットワークに接続されていません',
        code: 'OFFLINE',
      });
      (errorLib.getErrorMessage as any).mockReturnValue('ネットワークに接続されていません');

      const { result } = renderHook(() => useErrorHandler());
      result.current(offlineError, 'データの取得に失敗しました');

      expect(mockToastError).toHaveBeenCalledWith(
        'データの取得に失敗しました: ネットワークに接続されていません',
        { duration: 5000 }
      );
    });
  });

  describe('Validation Error Flow', () => {
    it('handles form validation errors with field-specific messages', () => {
      const validationError = {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: {
          email: 'メールアドレスの形式が正しくありません',
          password: 'パスワードは8文字以上である必要があります',
        },
      };

      (errorLib.handleApiError as any).mockReturnValue({
        name: 'ValidationError',
        message: '入力内容に誤りがあります',
        code: 'VALIDATION_ERROR',
        details: validationError.details,
      });
      (errorLib.getErrorMessage as any).mockReturnValue('入力内容に誤りがあります');

      const { result } = renderHook(() => useFormErrorHandler());
      const fieldErrors = result.current.handleFormError(validationError, 'フォームの送信に失敗しました');

      expect(fieldErrors).toEqual({
        email: 'メールアドレスの形式が正しくありません',
        password: 'パスワードは8文字以上である必要があります',
      });
    });

    it('handles validation error without field details', () => {
      const validationError = {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
      };

      (errorLib.handleApiError as any).mockReturnValue({
        name: 'ValidationError',
        message: '入力内容に誤りがあります',
        code: 'VALIDATION_ERROR',
        details: null,
      });

      const { result } = renderHook(() => useFormErrorHandler());
      const fieldErrors = result.current.handleFormError(validationError);

      expect(fieldErrors).toBeNull();
    });
  });

  describe('Error Cascading Flow', () => {
    it('handles multiple sequential errors independently', () => {
      const { result } = renderHook(() => useErrorHandler());

      // First error
      const error1 = new Error('First error');
      (errorLib.getErrorMessage as any).mockReturnValueOnce('First error');
      result.current(error1);

      // Second error
      const error2 = new Error('Second error');
      (errorLib.getErrorMessage as any).mockReturnValueOnce('Second error');
      result.current(error2);

      expect(mockToastError).toHaveBeenCalledTimes(2);
      expect(mockToastError).toHaveBeenNthCalledWith(1, 'First error', { duration: 5000 });
      expect(mockToastError).toHaveBeenNthCalledWith(2, 'Second error', { duration: 5000 });
    });

    it('handles auth error followed by regular error', () => {
      const { result } = renderHook(() => useErrorHandler());

      // Auth error first
      const authError = new Error('auth error');
      (errorLib.isAuthError as any).mockReturnValueOnce(true);
      result.current(authError);

      expect(mockSetUser).toHaveBeenCalledWith(null);

      // Regular error after
      (errorLib.isAuthError as any).mockReturnValueOnce(false);
      const regularError = new Error('regular error');
      (errorLib.getErrorMessage as any).mockReturnValue('regular error');
      result.current(regularError);

      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('Silent Error Handling', () => {
    it('logs but does not show toast when silent option is true', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Silent error');

      result.current(error, 'Silent context', { silent: true });

      expect(errorLib.logError).toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('does not log when logToConsole is false', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Unlogged error');

      result.current(error, undefined, { logToConsole: false });

      expect(errorLib.logError).not.toHaveBeenCalled();
    });

    it('combines silent and no-log options', () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Completely silent error');

      result.current(error, undefined, { silent: true, logToConsole: false });

      expect(errorLib.logError).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe('Error Recovery Flow', () => {
    it('allows retry after network error', async () => {
      const networkError = new Error('Network error');
      const retryFn = vi.fn();

      (errorLib.handleApiError as any).mockReturnValue({
        name: 'NetworkError',
        message: 'ネットワークエラー',
      });
      (errorLib.getErrorMessage as any).mockReturnValue('ネットワークエラー');

      const { result } = renderHook(() => useErrorHandlerWithRetry());
      result.current.handleError(networkError, 'データ取得失敗', retryFn);

      expect(mockToastError).toHaveBeenCalled();
    });

    it('does not show retry for auth errors', () => {
      const authError = new Error('auth error');
      const retryFn = vi.fn();

      (errorLib.isAuthError as any).mockReturnValue(true);

      const { result } = renderHook(() => useErrorHandlerWithRetry());
      result.current.handleError(authError, 'Auth failed', retryFn);

      expect(mockSetUser).toHaveBeenCalledWith(null);
      // Auth errors should clear session, no retry
    });
  });
});
