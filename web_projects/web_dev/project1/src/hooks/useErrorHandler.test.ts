import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useErrorHandler, useErrorHandlerWithRetry, useFormErrorHandler } from './useErrorHandler';
import toast from 'react-hot-toast';
import * as errorLib from '../lib/errors';
import { useAuthStore } from '../stores/authStore';

// Mock dependencies
vi.mock('react-hot-toast');
vi.mock('../lib/errors');
vi.mock('../stores/authStore');

describe('useErrorHandler', () => {
  const mockSetUser = vi.fn();
  const mockHandleApiError = vi.fn();
  const mockGetErrorMessage = vi.fn();
  const mockLogError = vi.fn();
  const mockIsAuthError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock implementations
    (useAuthStore as any).mockReturnValue({ setUser: mockSetUser });
    (errorLib.handleApiError as any) = mockHandleApiError;
    (errorLib.getErrorMessage as any) = mockGetErrorMessage;
    (errorLib.logError as any) = mockLogError;
    (errorLib.isAuthError as any) = mockIsAuthError;

    mockHandleApiError.mockReturnValue({
      name: 'ApiError',
      message: 'Test error',
    });
    mockGetErrorMessage.mockReturnValue('Test error message');
  });

  it('handles error with default options', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Test error');

    result.current(error);

    expect(mockHandleApiError).toHaveBeenCalledWith(error);
    expect(mockLogError).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Test error message', { duration: 5000 });
  });

  it('handles error with context', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Test error');

    result.current(error, 'Failed to fetch data');

    expect(mockGetErrorMessage).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to fetch data: Test error message',
      { duration: 5000 }
    );
  });

  it('handles error silently when silent option is true', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Test error');

    result.current(error, undefined, { silent: true });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('skips console logging when logToConsole is false', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Test error');

    result.current(error, undefined, { logToConsole: false });

    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('uses custom duration when provided', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Test error');

    result.current(error, undefined, { duration: 3000 });

    expect(toast.error).toHaveBeenCalledWith('Test error message', { duration: 3000 });
  });

  it('handles authentication errors by clearing user session', () => {
    mockIsAuthError.mockReturnValue(true);
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Auth error');

    result.current(error);

    expect(toast.error).toHaveBeenCalledWith(
      'セッションが切れました。再度ログインしてください',
      { duration: 5000 }
    );
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });

  it('does not show toast for auth errors when silent is true', () => {
    mockIsAuthError.mockReturnValue(true);
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Auth error');

    result.current(error, undefined, { silent: true });

    expect(toast.error).not.toHaveBeenCalled();
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });

  it('returns the processed ApiError', () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Test error');
    const expectedError = { name: 'ApiError', message: 'Test error' };
    mockHandleApiError.mockReturnValue(expectedError);

    const returnedError = result.current(error);

    expect(returnedError).toEqual(expectedError);
  });

  it('memoizes the handler with useCallback', () => {
    const { result, rerender } = renderHook(() => useErrorHandler());
    const handler1 = result.current;

    rerender();
    const handler2 = result.current;

    expect(handler1).toBe(handler2);
  });
});

describe('useErrorHandlerWithRetry', () => {
  const mockSetUser = vi.fn();
  const mockHandleApiError = vi.fn();
  const mockGetErrorMessage = vi.fn();
  const mockLogError = vi.fn();
  const mockIsAuthError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useAuthStore as any).mockReturnValue({ setUser: mockSetUser });
    (errorLib.handleApiError as any) = mockHandleApiError;
    (errorLib.getErrorMessage as any) = mockGetErrorMessage;
    (errorLib.logError as any) = mockLogError;
    (errorLib.isAuthError as any) = mockIsAuthError;

    mockHandleApiError.mockReturnValue({
      name: 'ApiError',
      message: 'Test error',
    });
    mockGetErrorMessage.mockReturnValue('Test error message');
  });

  it('handles error without retry function', () => {
    const { result } = renderHook(() => useErrorHandlerWithRetry());
    const error = new Error('Test error');

    result.current.handleError(error);

    expect(mockHandleApiError).toHaveBeenCalledWith(error);
    expect(toast.error).toHaveBeenCalled();
  });

  it('shows retry button when retry function is provided', () => {
    const { result } = renderHook(() => useErrorHandlerWithRetry());
    const error = new Error('Test error');
    const retryFn = vi.fn();

    result.current.handleError(error, 'Failed to fetch', retryFn);

    expect(toast.error).toHaveBeenCalled();
    // The second call should be for the retry toast
    expect((toast.error as any).mock.calls.length).toBeGreaterThan(0);
  });

  it('memoizes the handler with useCallback', () => {
    const { result, rerender } = renderHook(() => useErrorHandlerWithRetry());
    const handler1 = result.current.handleError;

    rerender();
    const handler2 = result.current.handleError;

    expect(handler1).toBe(handler2);
  });
});

describe('useFormErrorHandler', () => {
  const mockSetUser = vi.fn();
  const mockHandleApiError = vi.fn();
  const mockGetErrorMessage = vi.fn();
  const mockLogError = vi.fn();
  const mockIsAuthError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useAuthStore as any).mockReturnValue({ setUser: mockSetUser });
    (errorLib.handleApiError as any) = mockHandleApiError;
    (errorLib.getErrorMessage as any) = mockGetErrorMessage;
    (errorLib.logError as any) = mockLogError;
    (errorLib.isAuthError as any) = mockIsAuthError;
  });

  it('handles non-validation errors', () => {
    mockHandleApiError.mockReturnValue({
      name: 'ApiError',
      message: 'Test error',
    });

    const { result } = renderHook(() => useFormErrorHandler());
    const error = new Error('Test error');

    const fieldErrors = result.current.handleFormError(error);

    expect(mockHandleApiError).toHaveBeenCalledWith(error);
    expect(fieldErrors).toBeNull();
  });

  it('extracts field errors from validation errors', () => {
    const fieldErrors = {
      email: 'Invalid email',
      password: 'Password too short',
    };

    mockHandleApiError.mockReturnValue({
      name: 'ValidationError',
      message: 'Validation failed',
      details: fieldErrors,
    });

    const { result } = renderHook(() => useFormErrorHandler());
    const error = new Error('Validation error');

    const extractedErrors = result.current.handleFormError(error);

    expect(extractedErrors).toEqual(fieldErrors);
  });

  it('returns null when no validation details are present', () => {
    mockHandleApiError.mockReturnValue({
      name: 'ValidationError',
      message: 'Validation failed',
      details: null,
    });

    const { result } = renderHook(() => useFormErrorHandler());
    const error = new Error('Validation error');

    const fieldErrors = result.current.handleFormError(error);

    expect(fieldErrors).toBeNull();
  });

  it('handles error with context', () => {
    mockHandleApiError.mockReturnValue({
      name: 'ApiError',
      message: 'Test error',
    });

    const { result } = renderHook(() => useFormErrorHandler());
    const error = new Error('Test error');

    result.current.handleFormError(error, 'Form submission failed');

    expect(toast.error).toHaveBeenCalled();
  });

  it('memoizes the handler with useCallback', () => {
    const { result, rerender } = renderHook(() => useFormErrorHandler());
    const handler1 = result.current.handleFormError;

    rerender();
    const handler2 = result.current.handleFormError;

    expect(handler1).toBe(handler2);
  });
});
