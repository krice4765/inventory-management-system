// 強化されたエラーハンドリングシステム
import toast from 'react-hot-toast';

// エラー分類
export type ErrorCategory =
  | 'network'
  | 'database'
  | 'authentication'
  | 'validation'
  | 'permission'
  | 'business_logic'
  | 'system'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  userId?: string;
  action?: string;
  component?: string;
  timestamp?: string;
  userAgent?: string;
  url?: string;
  stackTrace?: string;
  additionalData?: Record<string, any>;
}

export interface StructuredError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  context: ErrorContext;
  userMessage: string;
  recoveryActions: string[];
  timestamp: string;
}

/**
 * 強化されたエラーハンドラークラス
 */
export class EnhancedErrorHandler {
  private static instance: EnhancedErrorHandler;
  private errorLog: StructuredError[] = [];
  private maxLogSize = 100;
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;

  private constructor() {
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): EnhancedErrorHandler {
    if (!EnhancedErrorHandler.instance) {
      EnhancedErrorHandler.instance = new EnhancedErrorHandler();
    }
    return EnhancedErrorHandler.instance;
  }

  /**
   * グローバルエラーハンドラーの設定
   */
  private setupGlobalErrorHandlers(): void {
    // 未処理のJavaScriptエラー
    window.addEventListener('error', (event) => {
      this.handleError(
        new Error(event.message),
        {
          component: 'Global',
          action: 'Runtime Error',
          additionalData: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        }
      );
    });

    // 未処理のPromise拒否
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        new Error(event.reason?.message || 'Unhandled Promise Rejection'),
        {
          component: 'Global',
          action: 'Promise Rejection',
          additionalData: { reason: event.reason }
        }
      );
    });
  }

  /**
   * エラーの分類
   */
  private categorizeError(error: Error, context: ErrorContext): ErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('auth')) {
      return 'authentication';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }
    if (message.includes('permission') || message.includes('access denied')) {
      return 'permission';
    }
    if (message.includes('database') || message.includes('sql') || message.includes('supabase')) {
      return 'database';
    }
    if (context.component && context.component.includes('business')) {
      return 'business_logic';
    }
    if (message.includes('system') || message.includes('server')) {
      return 'system';
    }

    return 'unknown';
  }

  /**
   * エラーの重要度判定
   */
  private determineSeverity(category: ErrorCategory, error: Error): ErrorSeverity {
    switch (category) {
      case 'authentication':
      case 'permission':
        return 'high';
      case 'database':
      case 'system':
        return 'critical';
      case 'network':
        return 'medium';
      case 'validation':
        return 'low';
      case 'business_logic':
        return 'medium';
      default:
        return error.name === 'TypeError' ? 'high' : 'medium';
    }
  }

  /**
   * ユーザー向けメッセージの生成
   */
  private generateUserMessage(category: ErrorCategory, severity: ErrorSeverity): string {
    const messages = {
      network: {
        low: 'ネットワークの接続を確認してください',
        medium: 'サーバーとの通信に問題があります。しばらく待ってから再試行してください',
        high: 'ネットワークエラーが発生しました。管理者にお問い合わせください',
        critical: '重大なネットワークエラーが発生しました'
      },
      database: {
        low: 'データの処理中に問題が発生しました',
        medium: 'データベースとの接続に問題があります',
        high: 'データベースエラーが発生しました',
        critical: '重大なデータベースエラーが発生しました。システム管理者にご連絡ください'
      },
      authentication: {
        low: '認証情報を確認してください',
        medium: 'ログインし直してください',
        high: '認証に失敗しました。管理者にお問い合わせください',
        critical: '重大な認証エラーが発生しました'
      },
      validation: {
        low: '入力内容を確認してください',
        medium: '入力データに問題があります',
        high: '入力検証エラーが発生しました',
        critical: '重大な検証エラーが発生しました'
      },
      permission: {
        low: 'この操作の権限がありません',
        medium: 'アクセス権限を確認してください',
        high: '権限エラーが発生しました',
        critical: '重大な権限エラーが発生しました'
      },
      business_logic: {
        low: '処理を完了できませんでした',
        medium: 'ビジネスルールに適合しない操作です',
        high: 'ビジネスロジックエラーが発生しました',
        critical: '重大なビジネスロジックエラーが発生しました'
      },
      system: {
        low: 'システムで問題が発生しました',
        medium: 'システムエラーが発生しました。しばらく待ってから再試行してください',
        high: '重大なシステムエラーが発生しました',
        critical: 'システムが利用できません。管理者にご連絡ください'
      },
      unknown: {
        low: '予期しない問題が発生しました',
        medium: 'エラーが発生しました。再試行してください',
        high: '予期しないエラーが発生しました',
        critical: '重大なエラーが発生しました。管理者にご連絡ください'
      }
    };

    return messages[category][severity];
  }

  /**
   * 回復手順の生成
   */
  private generateRecoveryActions(category: ErrorCategory, severity: ErrorSeverity): string[] {
    const actions = {
      network: [
        'インターネット接続を確認する',
        'ページを再読み込みする',
        'しばらく待ってから再試行する',
        '管理者に連絡する'
      ],
      database: [
        'データを再確認する',
        '操作を再試行する',
        'システム管理者に連絡する'
      ],
      authentication: [
        'ログアウトしてから再ログインする',
        'ブラウザのキャッシュをクリアする',
        '管理者に権限を確認する'
      ],
      validation: [
        '入力内容を見直す',
        '必須項目が入力されているか確認する',
        'データ形式を確認する'
      ],
      permission: [
        '管理者に権限を確認する',
        '別のユーザーでログインを試す',
        'システム管理者に連絡する'
      ],
      business_logic: [
        '操作手順を確認する',
        'データの整合性を確認する',
        '管理者に問い合わせる'
      ],
      system: [
        'ページを再読み込みする',
        'ブラウザを再起動する',
        'システム管理者に連絡する'
      ],
      unknown: [
        'ページを再読み込みする',
        '操作を再試行する',
        '管理者に連絡する'
      ]
    };

    return actions[category] || actions.unknown;
  }

  /**
   * メインのエラーハンドリング関数
   */
  handleError(error: Error, context: ErrorContext = {}): StructuredError {
    const errorId = this.generateErrorId();
    const category = this.categorizeError(error, context);
    const severity = this.determineSeverity(category, error);
    const userMessage = this.generateUserMessage(category, severity);
    const recoveryActions = this.generateRecoveryActions(category, severity);

    const structuredError: StructuredError = {
      id: errorId,
      category,
      severity,
      message: error.message,
      originalError: error,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        stackTrace: error.stack
      },
      userMessage,
      recoveryActions,
      timestamp: new Date().toISOString()
    };

    // エラーログに追加
    this.addToErrorLog(structuredError);

    // ユーザーへの通知
    this.notifyUser(structuredError);

    // 重要度が高い場合はコンソールにも出力
    if (severity === 'high' || severity === 'critical') {
      console.error('重大なエラー:', structuredError);
    }

    // 外部サービスへの報告（本番環境用）
    this.reportError(structuredError);

    return structuredError;
  }

  /**
   * エラーIDの生成
   */
  private generateErrorId(): string {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * エラーログへの追加
   */
  private addToErrorLog(error: StructuredError): void {
    this.errorLog.unshift(error);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.pop();
    }
  }

  /**
   * ユーザーへの通知
   */
  private notifyUser(error: StructuredError): void {
    const toastOptions = {
      duration: this.getToastDuration(error.severity),
      style: this.getToastStyle(error.severity)
    };

    switch (error.severity) {
      case 'critical':
        toast.error(`🚨 ${error.userMessage}`, toastOptions);
        break;
      case 'high':
        toast.error(`❌ ${error.userMessage}`, toastOptions);
        break;
      case 'medium':
        toast.error(`⚠️ ${error.userMessage}`, toastOptions);
        break;
      case 'low':
        toast(`ℹ️ ${error.userMessage}`, toastOptions);
        break;
    }
  }

  /**
   * トースト通知の期間設定
   */
  private getToastDuration(severity: ErrorSeverity): number {
    switch (severity) {
      case 'critical': return 8000;
      case 'high': return 6000;
      case 'medium': return 4000;
      case 'low': return 3000;
    }
  }

  /**
   * トースト通知のスタイル設定
   */
  private getToastStyle(severity: ErrorSeverity): Record<string, string> {
    const baseStyle = {
      borderRadius: '8px',
      fontWeight: '500',
      fontSize: '14px'
    };

    switch (severity) {
      case 'critical':
        return {
          ...baseStyle,
          background: '#dc2626',
          color: '#ffffff',
          border: '2px solid #991b1b'
        };
      case 'high':
        return {
          ...baseStyle,
          background: '#ea580c',
          color: '#ffffff',
          border: '2px solid #c2410c'
        };
      case 'medium':
        return {
          ...baseStyle,
          background: '#f59e0b',
          color: '#ffffff',
          border: '2px solid #d97706'
        };
      case 'low':
        return {
          ...baseStyle,
          background: '#3b82f6',
          color: '#ffffff',
          border: '2px solid #2563eb'
        };
    }
  }

  /**
   * 外部サービスへのエラー報告
   */
  private async reportError(error: StructuredError): Promise<void> {
    // 本番環境では外部ログサービス（Sentry、LogRocket等）にエラーを送信
    if (process.env.NODE_ENV === 'production') {
      try {
        // await externalErrorService.report(error);
      } catch (reportingError) {
        console.error('エラーレポートの送信に失敗:', reportingError);
      }
    }
  }

  /**
   * リトライ機能付きの関数実行
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: ErrorContext,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    const actionKey = `${context.component || 'unknown'}_${context.action || 'unknown'}`;
    const attempts = this.retryAttempts.get(actionKey) || 0;

    try {
      const result = await fn();
      // 成功した場合はリトライカウントをリセット
      this.retryAttempts.delete(actionKey);
      return result;
    } catch (error) {
      const structuredError = this.handleError(error as Error, context);

      if (attempts < maxRetries && this.shouldRetry(structuredError)) {
        this.retryAttempts.set(actionKey, attempts + 1);
        const delay = this.calculateRetryDelay(attempts);

        toast(`🔄 ${attempts + 1}回目の再試行中... (${delay/1000}秒後)`, {
          duration: delay,
          style: { background: '#6366f1', color: '#ffffff' }
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(fn, context, maxRetries);
      } else {
        this.retryAttempts.delete(actionKey);
        throw structuredError;
      }
    }
  }

  /**
   * リトライすべきかの判定
   */
  private shouldRetry(error: StructuredError): boolean {
    // ネットワークエラーやシステムエラーはリトライする
    return ['network', 'system'].includes(error.category) &&
           ['low', 'medium'].includes(error.severity);
  }

  /**
   * リトライ遅延時間の計算（指数バックオフ）
   */
  private calculateRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 8000); // 最大8秒
  }

  /**
   * エラーログの取得
   */
  getErrorLog(): StructuredError[] {
    return [...this.errorLog];
  }

  /**
   * エラー統計の取得
   */
  getErrorStatistics() {
    const total = this.errorLog.length;
    const categoryCounts = this.errorLog.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCategory, number>);

    const severityCounts = this.errorLog.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    return {
      total,
      categoryCounts,
      severityCounts,
      recentErrors: this.errorLog.slice(0, 10)
    };
  }

  /**
   * エラーログのクリア
   */
  clearErrorLog(): void {
    this.errorLog = [];
    this.retryAttempts.clear();
  }
}

// シングルトンインスタンスのエクスポート
export const errorHandler = EnhancedErrorHandler.getInstance();

// 便利なヘルパー関数

/**
 * 非同期操作の安全な実行
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: ErrorContext
): Promise<{ data?: T; error?: StructuredError }> {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    const structuredError = errorHandler.handleError(error as Error, context);
    return { error: structuredError };
  }
}

/**
 * React Query用のエラーハンドラー
 */
export function createQueryErrorHandler(context: ErrorContext) {
  return (error: Error) => {
    return errorHandler.handleError(error, {
      ...context,
      action: 'Query Error'
    });
  };
}

/**
 * フォーム送信用のエラーハンドラー
 */
export function createFormErrorHandler(formName: string) {
  return (error: Error) => {
    return errorHandler.handleError(error, {
      component: 'Form',
      action: `${formName} Submit`
    });
  };
}