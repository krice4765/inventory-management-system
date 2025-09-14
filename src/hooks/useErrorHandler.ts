// React用の強化エラーハンドリングフック
import { useCallback, useState, useEffect } from 'react';
import { errorHandler, ErrorContext, StructuredError, safeExecute } from '../utils/enhancedErrorHandler';

/**
 * エラーハンドリング用のメインフック
 */
export const useErrorHandler = (defaultContext?: ErrorContext) => {
  const [lastError, setLastError] = useState<StructuredError | null>(null);
  const [errorCount, setErrorCount] = useState(0);

  const handleError = useCallback((error: Error, context?: ErrorContext) => {
    const mergedContext = { ...defaultContext, ...context };
    const structuredError = errorHandler.handleError(error, mergedContext);
    setLastError(structuredError);
    setErrorCount(prev => prev + 1);
    return structuredError;
  }, [defaultContext]);

  const clearLastError = useCallback(() => {
    setLastError(null);
  }, []);

  const resetErrorCount = useCallback(() => {
    setErrorCount(0);
  }, []);

  return {
    handleError,
    lastError,
    errorCount,
    clearLastError,
    resetErrorCount
  };
};

/**
 * 非同期操作用のフック
 */
export const useAsyncOperation = <T>(
  operation: () => Promise<T>,
  context?: ErrorContext
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StructuredError | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await safeExecute(operation, context || {});

    if (result.error) {
      setError(result.error);
      setData(null);
    } else {
      setData(result.data || null);
      setError(null);
    }

    setLoading(false);
    return result;
  }, [operation, context]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset
  };
};

/**
 * リトライ機能付き非同期操作フック
 */
export const useAsyncWithRetry = <T>(
  operation: () => Promise<T>,
  context?: ErrorContext,
  maxRetries: number = 3
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StructuredError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRetryCount(0);

    try {
      const result = await errorHandler.executeWithRetry(
        operation,
        context || {},
        maxRetries
      );
      setData(result);
      setError(null);
      return { data: result };
    } catch (structuredError) {
      setError(structuredError as StructuredError);
      setData(null);
      return { error: structuredError as StructuredError };
    } finally {
      setLoading(false);
    }
  }, [operation, context, maxRetries]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    setRetryCount(0);
  }, []);

  return {
    data,
    loading,
    error,
    retryCount,
    execute,
    reset
  };
};

/**
 * フォーム用エラーハンドリングフック
 */
export const useFormErrorHandler = (formName: string) => {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleError = useCallback((error: Error, field?: string) => {
    const structuredError = errorHandler.handleError(error, {
      component: 'Form',
      action: `${formName} Validation`,
      additionalData: { field }
    });

    if (field) {
      setFieldErrors(prev => ({
        ...prev,
        [field]: structuredError.userMessage
      }));
    } else {
      setGeneralError(structuredError.userMessage);
    }

    return structuredError;
  }, [formName]);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearGeneralError = useCallback(() => {
    setGeneralError(null);
  }, []);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
    setGeneralError(null);
  }, []);

  const hasErrors = Object.keys(fieldErrors).length > 0 || generalError !== null;

  return {
    fieldErrors,
    generalError,
    handleError,
    clearFieldError,
    clearGeneralError,
    clearAllErrors,
    hasErrors
  };
};

/**
 * API呼び出し用エラーハンドリングフック
 */
export const useApiErrorHandler = (apiName: string) => {
  const [lastError, setLastError] = useState<StructuredError | null>(null);
  const [requestInProgress, setRequestInProgress] = useState(false);

  const handleApiError = useCallback((error: Error, endpoint?: string) => {
    const structuredError = errorHandler.handleError(error, {
      component: 'API',
      action: `${apiName} Request`,
      additionalData: { endpoint }
    });

    setLastError(structuredError);
    return structuredError;
  }, [apiName]);

  const executeApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    endpoint?: string
  ): Promise<{ data?: T; error?: StructuredError }> => {
    setRequestInProgress(true);
    setLastError(null);

    const result = await safeExecute(apiCall, {
      component: 'API',
      action: `${apiName} Request`,
      additionalData: { endpoint }
    });

    if (result.error) {
      setLastError(result.error);
    }

    setRequestInProgress(false);
    return result;
  }, [apiName]);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    lastError,
    requestInProgress,
    handleApiError,
    executeApiCall,
    clearError
  };
};

/**
 * エラー統計監視フック
 */
export const useErrorStatistics = () => {
  const [statistics, setStatistics] = useState(errorHandler.getErrorStatistics());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatistics(errorHandler.getErrorStatistics());
    }, 10000); // 10秒ごとに更新

    return () => clearInterval(interval);
  }, []);

  const refreshStatistics = useCallback(() => {
    setStatistics(errorHandler.getErrorStatistics());
  }, []);

  const clearErrorLog = useCallback(() => {
    errorHandler.clearErrorLog();
    setStatistics(errorHandler.getErrorStatistics());
  }, []);

  return {
    statistics,
    refreshStatistics,
    clearErrorLog
  };
};

/**
 * コンポーネントレベルのエラー境界フック
 */
export const useErrorBoundary = (componentName: string) => {
  const [error, setError] = useState<StructuredError | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const captureError = useCallback((error: Error, errorInfo?: any) => {
    const structuredError = errorHandler.handleError(error, {
      component: componentName,
      action: 'Component Error',
      additionalData: { errorInfo }
    });

    setError(structuredError);
    return structuredError;
  }, [componentName]);

  return {
    error,
    resetError,
    captureError,
    hasError: error !== null
  };
};

/**
 * デバウンスされたエラーハンドリングフック（連続エラーの制御）
 */
export const useDebouncedErrorHandler = (delay: number = 1000) => {
  const [debouncedErrors, setDebouncedErrors] = useState<Map<string, StructuredError>>(new Map());
  const [timeouts, setTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map());

  const handleError = useCallback((error: Error, context?: ErrorContext) => {
    const errorKey = `${context?.component || 'unknown'}_${error.message}`;

    // 既存のタイムアウトをクリア
    const existingTimeout = timeouts.get(errorKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // 新しいタイムアウトを設定
    const newTimeout = setTimeout(() => {
      const structuredError = errorHandler.handleError(error, context);
      setDebouncedErrors(prev => new Map(prev.set(errorKey, structuredError)));

      // タイムアウト参照をクリーンアップ
      setTimeouts(prev => {
        const newTimeouts = new Map(prev);
        newTimeouts.delete(errorKey);
        return newTimeouts;
      });
    }, delay);

    setTimeouts(prev => new Map(prev.set(errorKey, newTimeout)));

    return errorKey;
  }, [delay, timeouts]);

  const clearDebouncedError = useCallback((errorKey: string) => {
    const timeout = timeouts.get(errorKey);
    if (timeout) {
      clearTimeout(timeout);
    }

    setTimeouts(prev => {
      const newTimeouts = new Map(prev);
      newTimeouts.delete(errorKey);
      return newTimeouts;
    });

    setDebouncedErrors(prev => {
      const newErrors = new Map(prev);
      newErrors.delete(errorKey);
      return newErrors;
    });
  }, [timeouts]);

  // コンポーネントのアンマウント時にタイムアウトをクリーンアップ
  useEffect(() => {
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [timeouts]);

  return {
    handleError,
    debouncedErrors: Array.from(debouncedErrors.values()),
    clearDebouncedError,
    clearAllDebouncedErrors: () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      setTimeouts(new Map());
      setDebouncedErrors(new Map());
    }
  };
};