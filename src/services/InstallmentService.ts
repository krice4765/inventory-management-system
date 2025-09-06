// ===============================================================
// 🏗️ Phase 3: InstallmentService - ビジネスロジック統一化
// ===============================================================
// 目的: 型安全性とビジネスルールの中央管理

import { supabase } from '../lib/supabase';
import type {
  AddInstallmentV2Response,
  ConfirmInstallmentResponse,
  DeleteInstallmentResponse,
  OrderInstallmentSummaryResponse,
  CreateInstallmentRequest,
  ConfirmInstallmentRequest,
  DeleteInstallmentRequest,
  InstallmentError,
  InstallmentErrorCode,
  OperationResult,
  ValidationResult,
  INSTALLMENT_CONFIG
} from '../types/installment';
import {
  isAddInstallmentV2Response,
  safeParseNumber,
  parseInstallmentStatus,
  isValidDateString,
} from '../types/installment';

// ===============================================================
// 1. InstallmentService クラス - Singleton Pattern
// ===============================================================

class InstallmentService {
  private static instance: InstallmentService;
  
  private constructor() {}
  
  public static getInstance(): InstallmentService {
    if (!InstallmentService.instance) {
      InstallmentService.instance = new InstallmentService();
    }
    return InstallmentService.instance;
  }
  
  // ===============================================================
  // 2. 分納作成 - 完全型安全性保証
  // ===============================================================
  
  /**
   * 分納を安全に作成する（v2 RPC使用）
   */
  async createInstallment(request: CreateInstallmentRequest): Promise<OperationResult<AddInstallmentV2Response>> {
    try {
      // 事前バリデーション
      const validationError = this.validateCreateRequest(request);
      if (validationError) {
        return { success: false, error: validationError };
      }
      
      // RPC呼び出し
      const { data, error } = await supabase.rpc('add_purchase_installment_v2', {
        p_parent_order_id: request.parentOrderId,
        p_amount: request.amount,
        p_status: request.status,
        p_due_date: request.dueDate || this.getDefaultDueDate(),
        p_memo: request.memo || null,
      });
      
      if (error) {
        return { 
          success: false, 
          error: this.mapSupabaseError(error, 'NETWORK_ERROR') 
        };
      }
      
      // レスポンス検証
      if (!data || data.length === 0) {
        return { 
          success: false, 
          error: new InstallmentError('UNKNOWN_ERROR', 'レスポンスが空です') 
        };
      }
      
      const response = data[0];
      
      // 型検証
      if (!isAddInstallmentV2Response(response)) {
        return { 
          success: false, 
          error: new InstallmentError('VALIDATION_FAILED', 'レスポンス形式が不正です') 
        };
      }
      
      // 成功・失敗の判定
      if (!response.success) {
        const errorCode = response.validation_info.error_code || 'UNKNOWN_ERROR';
        const errorMessage = response.validation_info.error_message || 'エラーが発生しました';
        return { 
          success: false, 
          error: new InstallmentError(errorCode, errorMessage, response.validation_info) 
        };
      }
      
      return { success: true, data: response };
      
    } catch (error) {
      console.error('InstallmentService.createInstallment error:', error);
      return { 
        success: false, 
        error: new InstallmentError('UNKNOWN_ERROR', '分納作成中に予期しないエラーが発生しました', { originalError: error }) 
      };
    }
  }
  
  // ===============================================================
  // 3. 分納確定
  // ===============================================================
  
  /**
   * 分納を確定する
   */
  async confirmInstallment(request: ConfirmInstallmentRequest): Promise<OperationResult<ConfirmInstallmentResponse>> {
    try {
      const { data, error } = await supabase.rpc('confirm_purchase_installment', {
        p_transaction_id: request.transactionId,
        p_confirm_amount: request.confirmAmount || null,
      });
      
      if (error) {
        return { 
          success: false, 
          error: this.mapSupabaseError(error, 'NETWORK_ERROR') 
        };
      }
      
      if (!data || data.length === 0) {
        return { 
          success: false, 
          error: new InstallmentError('TRANSACTION_NOT_FOUND', '対象の分納が見つかりません') 
        };
      }
      
      const response = data[0];
      
      if (!response.success) {
        const errorMessage = response.validation_info.error || 'エラーが発生しました';
        const errorCode = response.validation_info.error_code || 'VALIDATION_FAILED';
        return { 
          success: false, 
          error: new InstallmentError(errorCode, errorMessage, response.validation_info) 
        };
      }
      
      return { success: true, data: response };
      
    } catch (error) {
      console.error('InstallmentService.confirmInstallment error:', error);
      return { 
        success: false, 
        error: new InstallmentError('UNKNOWN_ERROR', '分納確定中に予期しないエラーが発生しました', { originalError: error }) 
      };
    }
  }
  
  // ===============================================================
  // 4. 分納削除
  // ===============================================================
  
  /**
   * 分納を安全に削除する
   */
  async deleteInstallment(request: DeleteInstallmentRequest): Promise<OperationResult<DeleteInstallmentResponse>> {
    try {
      const { data, error } = await supabase.rpc('delete_purchase_installment', {
        p_transaction_id: request.transactionId,
        p_force_delete: request.forceDelete || false,
      });
      
      if (error) {
        return { 
          success: false, 
          error: this.mapSupabaseError(error, 'NETWORK_ERROR') 
        };
      }
      
      if (!data || data.length === 0) {
        return { 
          success: false, 
          error: new InstallmentError('TRANSACTION_NOT_FOUND', '対象の分納が見つかりません') 
        };
      }
      
      const response = data[0];
      
      if (!response.success) {
        const errorMessage = response.info.error || 'エラーが発生しました';
        return { 
          success: false, 
          error: new InstallmentError('CANNOT_DELETE_CONFIRMED', errorMessage, response.info) 
        };
      }
      
      return { success: true, data: response };
      
    } catch (error) {
      console.error('InstallmentService.deleteInstallment error:', error);
      return { 
        success: false, 
        error: new InstallmentError('UNKNOWN_ERROR', '分納削除中に予期しないエラーが発生しました', { originalError: error }) 
      };
    }
  }
  
  // ===============================================================
  // 5. 発注サマリー取得
  // ===============================================================
  
  /**
   * 発注の分納サマリーを取得する
   */
  async getOrderSummary(orderId: string): Promise<OperationResult<OrderInstallmentSummaryResponse>> {
    try {
      if (!orderId) {
        return { 
          success: false, 
          error: new InstallmentError('ORDER_NOT_FOUND', '発注IDが指定されていません') 
        };
      }
      
      const { data, error } = await supabase.rpc('get_order_installment_summary', {
        p_order_id: orderId,
      });
      
      if (error) {
        return { 
          success: false, 
          error: this.mapSupabaseError(error, 'NETWORK_ERROR') 
        };
      }
      
      if (!data || data.length === 0) {
        return { 
          success: false, 
          error: new InstallmentError('ORDER_NOT_FOUND', '指定された発注が見つかりません') 
        };
      }
      
      return { success: true, data: data[0] };
      
    } catch (error) {
      console.error('InstallmentService.getOrderSummary error:', error);
      return { 
        success: false, 
        error: new InstallmentError('UNKNOWN_ERROR', 'サマリー取得中に予期しないエラーが発生しました', { originalError: error }) 
      };
    }
  }
  
  // ===============================================================
  // 6. バリデーション機能
  // ===============================================================
  
  /**
   * 分納作成リクエストの事前バリデーション
   */
  private validateCreateRequest(request: CreateInstallmentRequest): InstallmentError | null {
    // 必須フィールドチェック
    if (!request.parentOrderId) {
      return new InstallmentError('ORDER_NOT_FOUND', '発注IDが指定されていません');
    }
    
    // 金額バリデーション
    const amount = safeParseNumber(request.amount);
    if (amount <= 0) {
      return new InstallmentError('INVALID_AMOUNT', '分納金額は0より大きい必要があります');
    }
    
    if (amount < INSTALLMENT_CONFIG.MIN_AMOUNT) {
      return new InstallmentError('INVALID_AMOUNT', `分納金額は¥${INSTALLMENT_CONFIG.MIN_AMOUNT}以上である必要があります`);
    }
    
    // ステータスバリデーション
    const status = parseInstallmentStatus(request.status);
    if (!['draft', 'confirmed'].includes(status)) {
      return new InstallmentError('VALIDATION_FAILED', '無効なステータスが指定されています');
    }
    
    // 日付バリデーション
    if (request.dueDate && !isValidDateString(request.dueDate)) {
      return new InstallmentError('VALIDATION_FAILED', '無効な支払期日が指定されています');
    }
    
    // メモ長さチェック
    if (request.memo && request.memo.length > 500) {
      return new InstallmentError('VALIDATION_FAILED', 'メモは500文字以内で入力してください');
    }
    
    return null; // バリデーション成功
  }
  
  // ===============================================================
  // 7. ユーティリティ機能
  // ===============================================================
  
  /**
   * デフォルト支払期日を取得
   */
  private getDefaultDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + INSTALLMENT_CONFIG.DEFAULT_DUE_DAYS);
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Supabaseエラーを標準エラーに変換
   */
  private mapSupabaseError(error: any, defaultCode: InstallmentErrorCode): InstallmentError {
    const message = error.message || 'データベースエラーが発生しました';
    
    // PostgreSQLエラーコードのマッピング
    if (error.code === 'P0001') {
      return new InstallmentError('AMOUNT_EXCEEDED', message, error);
    }
    if (error.code === 'P0002') {
      return new InstallmentError('VALIDATION_FAILED', message, error);
    }
    if (error.code === 'P0003') {
      return new InstallmentError('ORDER_NOT_FOUND', message, error);
    }
    
    // 一般的なネットワーク・DB エラー
    if (error.code === 'PGRST301' || error.code === '42P01') {
      return new InstallmentError('NETWORK_ERROR', 'データベース接続エラーが発生しました', error);
    }
    
    return new InstallmentError(defaultCode, message, error);
  }
  
  // ===============================================================
  // 8. 計算ヘルパー
  // ===============================================================
  
  /**
   * 残額を安全に計算
   */
  calculateRemainingAmount(orderTotal: number, allocatedTotal: number): number {
    return Math.max(0, safeParseNumber(orderTotal) - safeParseNumber(allocatedTotal));
  }
  
  /**
   * 完了率を計算
   */
  calculateCompletionRate(orderTotal: number, allocatedTotal: number): number {
    const total = safeParseNumber(orderTotal);
    const allocated = safeParseNumber(allocatedTotal);
    
    if (total <= 0) return 0;
    return Math.round((allocated / total) * 100 * 10) / 10; // 小数第1位まで
  }
  
  /**
   * 分納可能かどうかを判定
   */
  canAddInstallment(orderTotal: number, allocatedTotal: number, installmentCount: number): boolean {
    const remaining = this.calculateRemainingAmount(orderTotal, allocatedTotal);
    return remaining >= INSTALLMENT_CONFIG.MIN_AMOUNT && installmentCount < INSTALLMENT_CONFIG.MAX_INSTALLMENTS;
  }
  
  /**
   * リトライ処理を実行
   */
  async withRetry<T>(
    operation: () => Promise<OperationResult<T>>,
    maxRetries: number = INSTALLMENT_CONFIG.MAX_RETRIES
  ): Promise<OperationResult<T>> {
    let lastError: InstallmentError | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await operation();
      
      if (result.success || !result.error.isRetryable) {
        return result;
      }
      
      lastError = result.error;
      
      if (attempt < maxRetries) {
        await this.delay(INSTALLMENT_CONFIG.RETRY_DELAY_MS * attempt);
      }
    }
    
    return { 
      success: false, 
      error: lastError || new InstallmentError('UNKNOWN_ERROR', 'リトライ処理に失敗しました') 
    };
  }
  
  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===============================================================
// 9. エクスポート
// ===============================================================

// シングルトンインスタンスをエクスポート
export const installmentService = InstallmentService.getInstance();

// 型定義の再エクスポート（便利性のため）
export type {
  CreateInstallmentRequest,
  ConfirmInstallmentRequest,
  DeleteInstallmentRequest,
  AddInstallmentV2Response,
  ConfirmInstallmentResponse,
  DeleteInstallmentResponse,
  OrderInstallmentSummaryResponse,
  InstallmentError,
  OperationResult,
} from '../types/installment';

// デフォルトエクスポート
export default installmentService;