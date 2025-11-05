import React, { useCallback } from 'react';
import toast from 'react-hot-toast';
import { handleApiError, getErrorMessage, logError, isAuthError } from '../lib/errors';
import { useAuthStore } from '../stores/authStore';

/**
 * Custom hook for unified error handling across the application
 *
 * @example
 * ```typescript
 * const handleError = useErrorHandler();
 *
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   handleError(error, 'Failed to fetch data');
 * }
 * ```
 */
export function useErrorHandler() {
  const { setUser } = useAuthStore();

  const handleError = useCallback(
    (error: unknown, context?: string, options?: {
      silent?: boolean;
      duration?: number;
      logToConsole?: boolean;
    }) => {
      const {
        silent = false,
        duration = 5000,
        logToConsole = true,
      } = options || {};

      // Convert to ApiError
      const apiError = handleApiError(error);

      // Log error to console (and potentially to error tracking service)
      if (logToConsole) {
        logError(apiError, context);
      }

      // Handle authentication errors
      if (isAuthError(error)) {
        if (!silent) {
          toast.error('セッションが切れました。再度ログインしてください', { duration });
        }
        // Clear user session
        setUser(null);
        return apiError;
      }

      // Show error toast
      if (!silent) {
        const message = context
          ? `${context}: ${getErrorMessage(apiError)}`
          : getErrorMessage(apiError);

        toast.error(message, { duration });
      }

      return apiError;
    },
    [setUser]
  );

  return handleError;
}

/**
 * Custom hook for error handling with retry capability
 *
 * @example
 * ```typescript
 * const { handleError, retry } = useErrorHandlerWithRetry();
 *
 * const fetchData = async () => {
 *   try {
 *     const data = await someApiCall();
 *     return data;
 *   } catch (error) {
 *     handleError(error, 'Failed to fetch data', fetchData);
 *   }
 * };
 * ```
 */
export function useErrorHandlerWithRetry() {
  const handleError = useErrorHandler();

  const handleErrorWithRetry = useCallback(
    (error: unknown, context?: string, retryFn?: () => void | Promise<void>, options?: {
      silent?: boolean;
      duration?: number;
      logToConsole?: boolean;
    }) => {
      const apiError = handleError(error, context, options);

      // Show retry option for retryable errors
      if (retryFn && apiError) {
        toast.error(
          (t) => (
            <div className="flex items-center justify-between gap-2">
              <span>{getErrorMessage(apiError)}</span>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  retryFn();
                }}
                className="px-3 py-1 bg-white text-red-600 rounded hover:bg-gray-100 font-medium text-sm"
              >
                再試行
              </button>
            </div>
          ),
          { duration: 7000 }
        );
      }

      return apiError;
    },
    [handleError]
  );

  return { handleError: handleErrorWithRetry };
}

/**
 * Custom hook for form error handling
 *
 * @example
 * ```typescript
 * const { handleFormError, clearFormErrors, formErrors } = useFormErrorHandler();
 *
 * try {
 *   await submitForm(data);
 * } catch (error) {
 *   handleFormError(error);
 * }
 * ```
 */
export function useFormErrorHandler() {
  const handleError = useErrorHandler();

  const handleFormError = useCallback(
    (error: unknown, context?: string) => {
      const apiError = handleError(error, context);

      // Check if it's a validation error with field-specific errors
      if (apiError && apiError.name === 'ValidationError' && apiError.details) {
        // Field-specific errors are already logged
        return apiError.details as Record<string, string>;
      }

      return null;
    },
    [handleError]
  );

  return { handleFormError };
}
