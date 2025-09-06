/**
 * エラーハンドリング統一システム
 * P0001→ユーザー向けメッセージ変換
 */

// エラーコードとメッセージのマッピング
export const ERROR_MESSAGES = {
  // 分納関連エラー
  P0001: {
    title: '分納金額が上限を超過しています',
    message: '入力された分納金額が残り金額を超過しています。残り金額を確認して正しい分納額を入力してください。',
    action: '分納額を調整してください',
    severity: 'error' as const,
    userFixable: true
  },
  P0002: {
    title: '分納の権限が不足しています',
    message: 'この発注に対する分納権限がありません。管理者に権限確認を依頼してください。',
    action: '管理者にお問い合わせください',
    severity: 'error' as const,
    userFixable: false
  },
  P0003: {
    title: '発注が確認されていません',
    message: 'この発注はまだ確認されていないため、分納を作成できません。',
    action: '発注を確認してから分納を作成してください',
    severity: 'warning' as const,
    userFixable: true
  },
  P0008: {
    title: '担当者の権限が不足しています',
    message: 'この担当者は発注権限を持っていません。適切な権限を持つ担当者を選択してください。',
    action: '担当者を変更してください',
    severity: 'error' as const,
    userFixable: true
  },

  // 一般的なエラー
  NETWORK_ERROR: {
    title: 'ネットワークエラー',
    message: 'ネットワーク接続に問題が発生しました。インターネット接続を確認してから再試行してください。',
    action: '再試行してください',
    severity: 'error' as const,
    userFixable: true
  },
  VALIDATION_ERROR: {
    title: '入力内容に誤りがあります',
    message: '入力された内容に不正な値が含まれています。すべての項目を確認してください。',
    action: '入力内容を確認してください',
    severity: 'warning' as const,
    userFixable: true
  },
  UNAUTHORIZED: {
    title: 'アクセス権限がありません',
    message: 'この機能にアクセスする権限がありません。管理者にお問い合わせください。',
    action: '管理者にお問い合わせください',
    severity: 'error' as const,
    userFixable: false
  },
  UNKNOWN_ERROR: {
    title: 'システムエラー',
    message: '予期しないエラーが発生しました。しばらく待ってから再試行してください。',
    action: '時間をおいて再試行してください',
    severity: 'error' as const,
    userFixable: true
  }
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;
export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface UserFriendlyError {
  code: string;
  title: string;
  message: string;
  action: string;
  severity: ErrorSeverity;
  userFixable: boolean;
  originalError?: any;
  context?: Record<string, any>;
  timestamp: Date;
}

/**
 * PostgreSQLエラーからエラーコードを抽出
 */
function extractPostgresErrorCode(error: any): string | null {
  if (!error) return null;
  
  // PostgreSQLエラーコードの取得
  if (error.code) {
    return error.code;
  }
  
  // メッセージからエラーコードを抽出
  if (error.message && typeof error.message === 'string') {
    const match = error.message.match(/\b(P\d{4})\b/);
    if (match) {
      return match[1];
    }
  }
  
  // Supabaseのエラーレスポンスからの抽出
  if (error.details && typeof error.details === 'string') {
    const match = error.details.match(/\b(P\d{4})\b/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * 標準API レスポンスからエラー情報を抽出
 */
function extractStandardApiError(response: any): { code: string; context?: any } | null {
  if (response && !response.success && response.error) {
    return {
      code: response.error.code || 'UNKNOWN_ERROR',
      context: response.error.context
    };
  }
  return null;
}

/**
 * ネットワークエラーの判定
 */
function isNetworkError(error: any): boolean {
  return !!(
    error.name === 'NetworkError' ||
    error.code === 'NETWORK_ERROR' ||
    error.message?.includes('fetch') ||
    error.message?.includes('network') ||
    error.message?.includes('NetworkError')
  );
}

/**
 * エラーをユーザーフレンドリーな形式に変換
 */
export function convertToUserFriendlyError(error: any): UserFriendlyError {
  const timestamp = new Date();
  
  // ネットワークエラーのチェック
  if (isNetworkError(error)) {
    const errorInfo = ERROR_MESSAGES.NETWORK_ERROR;
    return {
      code: 'NETWORK_ERROR',
      ...errorInfo,
      originalError: error,
      timestamp
    };
  }
  
  // 標準APIレスポンスからのエラー抽出
  const standardApiError = extractStandardApiError(error);
  if (standardApiError) {
    const errorInfo = ERROR_MESSAGES[standardApiError.code as ErrorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;
    return {
      code: standardApiError.code,
      ...errorInfo,
      originalError: error,
      context: standardApiError.context,
      timestamp
    };
  }
  
  // PostgreSQLエラーコードの抽出と変換
  const pgErrorCode = extractPostgresErrorCode(error);
  if (pgErrorCode && pgErrorCode in ERROR_MESSAGES) {
    const errorInfo = ERROR_MESSAGES[pgErrorCode as ErrorCode];
    return {
      code: pgErrorCode,
      ...errorInfo,
      originalError: error,
      timestamp
    };
  }
  
  // 認証エラーのチェック
  if (error.message?.includes('unauthorized') || error.status === 401) {
    const errorInfo = ERROR_MESSAGES.UNAUTHORIZED;
    return {
      code: 'UNAUTHORIZED',
      ...errorInfo,
      originalError: error,
      timestamp
    };
  }
  
  // 不明なエラー
  const errorInfo = ERROR_MESSAGES.UNKNOWN_ERROR;
  return {
    code: 'UNKNOWN_ERROR',
    ...errorInfo,
    originalError: error,
    timestamp
  };
}

/**
 * React Hook用のエラーハンドラー
 */
export function useErrorHandler() {
  const handleError = (error: any): UserFriendlyError => {
    const userError = convertToUserFriendlyError(error);
    
    // 開発環境では元のエラーもコンソールに出力
    if (import.meta.env.DEV) {
      console.group(`🚨 Error: ${userError.code}`);
      console.log('User message:', userError.message);
      console.log('Original error:', userError.originalError);
      if (userError.context) {
        console.log('Context:', userError.context);
      }
      console.groupEnd();
    }
    
    return userError;
  };
  
  return { handleError };
}

/**
 * エラー表示用のReactコンポーネントプロップス
 */
export interface ErrorDisplayProps {
  error: UserFriendlyError;
  onRetry?: () => void;
  onDismiss?: () => void;
  showTechnicalDetails?: boolean;
}

/**
 * P0001エラー専用のコンテキスト情報フォーマッター
 */
export function formatP0001Context(context?: Record<string, any>): string {
  if (!context) return '';
  
  const parts: string[] = [];
  
  if (context.remaining_amount !== undefined) {
    parts.push(`残り金額: ¥${context.remaining_amount.toLocaleString()}`);
  }
  
  if (context.attempted_amount !== undefined) {
    parts.push(`入力金額: ¥${context.attempted_amount.toLocaleString()}`);
  }
  
  if (context.excess_amount !== undefined) {
    parts.push(`超過金額: ¥${context.excess_amount.toLocaleString()}`);
  }
  
  if (context.existing_installments !== undefined) {
    parts.push(`既存分納: ${context.existing_installments}件`);
  }
  
  return parts.join(' | ');
}

/**
 * エラーレポート送信用のデータ作成
 */
export function createErrorReport(userError: UserFriendlyError): {
  errorId: string;
  reportData: Record<string, any>;
} {
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  const reportData = {
    errorId,
    code: userError.code,
    severity: userError.severity,
    userFixable: userError.userFixable,
    timestamp: userError.timestamp.toISOString(),
    context: userError.context,
    userAgent: navigator.userAgent,
    url: window.location.href,
    // 個人情報を除いた元のエラー情報
    originalError: {
      name: userError.originalError?.name,
      message: userError.originalError?.message,
      code: userError.originalError?.code
    }
  };
  
  return { errorId, reportData };
}

// 開発時のテスト用関数
if (import.meta.env.DEV) {
  // @ts-ignore
  window.testErrorHandler = () => {
    console.group('🧪 エラーハンドラーテスト');
    
    // P0001エラーのテスト
    const p0001Error = {
      code: 'P0001',
      message: 'Check constraint "check_installment_total" failed',
      details: 'P0001: 分納合計が発注金額を超過しています'
    };
    
    const userError = convertToUserFriendlyError(p0001Error);
    console.log('P0001 変換結果:', userError);
    
    // ネットワークエラーのテスト
    const networkError = new Error('NetworkError: fetch failed');
    networkError.name = 'NetworkError';
    
    const networkUserError = convertToUserFriendlyError(networkError);
    console.log('Network Error 変換結果:', networkUserError);
    
    console.groupEnd();
  };
}