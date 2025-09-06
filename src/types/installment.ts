// ===============================================================
// 🔒 Phase 3: TypeScript型定義 - 完全型安全性保証
// ===============================================================
// 目的: コンパイル時エラー検出とランタイム安全性の向上

// ===============================================================
// 1. 基本型定義
// ===============================================================

/** 分納の状態管理 */
export type InstallmentStatus = 'draft' | 'confirmed' | 'cancelled' | 'completed';

/** エラーコードの標準化 */
export type InstallmentErrorCode = 
  | 'SUCCESS'
  | 'ORDER_NOT_FOUND'
  | 'INVALID_AMOUNT'
  | 'AMOUNT_EXCEEDED'
  | 'TRANSACTION_NOT_FOUND'
  | 'ALREADY_CONFIRMED'
  | 'CANNOT_DELETE_CONFIRMED'
  | 'VALIDATION_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

/** バリデーション結果の共通型 */
export interface ValidationResult {
  isValid: boolean;
  errorCode: InstallmentErrorCode;
  errorMessage: string;
  orderTotal: number;
  allocatedTotal: number;
  remainingAmount: number;
}

// ===============================================================
// 2. RPC関数レスポンス型定義
// ===============================================================

/** 分納追加RPC v2のレスポンス型 */
export interface AddInstallmentV2Response {
  success: boolean;
  installment_id: string | null;
  parent_order_id: string;
  installment_no: number | null;
  transaction_no: string | null;
  status: InstallmentStatus;
  total_amount: number;
  memo: string | null;
  transaction_date: string;
  due_date: string;
  created_at: string | null;
  validation_info: {
    error_code?: InstallmentErrorCode;
    error_message?: string;
    order_total?: number;
    allocated_total?: number;
    remaining_amount?: number;
    validation_timestamp?: string;
    validation_passed?: boolean;
    installment_no?: number;
    retry_count?: number;
    processing_timestamp?: string;
  };
}

/** 分納確定RPCのレスポンス型 */
export interface ConfirmInstallmentResponse {
  success: boolean;
  transaction_id: string;
  old_status: InstallmentStatus;
  new_status: InstallmentStatus;
  confirmed_amount: number;
  validation_info: {
    error?: string;
    error_code?: InstallmentErrorCode;
    previous_amount?: number;
    confirmed_amount?: number;
    amount_changed?: boolean;
    confirmation_timestamp?: string;
    order_no?: string;
  };
}

/** 分納削除RPCのレスポンス型 */
export interface DeleteInstallmentResponse {
  success: boolean;
  deleted_transaction_id: string;
  deleted_amount: number | null;
  installment_no: number | null;
  order_no: string | null;
  info: {
    error?: string;
    deleted_status?: InstallmentStatus;
    deletion_timestamp?: string;
    force_delete_used?: boolean;
  };
}

/** 発注サマリーRPCのレスポンス型 */
export interface OrderInstallmentSummaryResponse {
  order_id: string;
  order_no: string;
  partner_name: string;
  order_total: number;
  allocated_total: number;
  remaining_amount: number;
  installment_count: number;
  completion_rate: number;
  status: '未分納' | '分納中' | '完了' | '超過エラー';
  installments: InstallmentDetail[];
  summary_info: {
    generated_at: string;
    next_installment_no: number;
    can_add_installment: boolean;
    integrity_status: 'OK' | 'ERROR';
  };
}

/** 分納詳細情報 */
export interface InstallmentDetail {
  id: string;
  installment_no: number;
  amount: number;
  status: InstallmentStatus;
  transaction_no: string;
  due_date: string;
  created_at: string;
}

// ===============================================================
// 3. フォーム・UI用型定義
// ===============================================================

/** 分納作成フォームデータ */
export interface CreateInstallmentFormData {
  amount: number;
  status: InstallmentStatus;
  dueDate?: string;
  memo?: string;
}

/** 分納作成リクエスト */
export interface CreateInstallmentRequest {
  parentOrderId: string;
  amount: number;
  status: InstallmentStatus;
  dueDate?: string;
  memo?: string;
}

/** 分納確定リクエスト */
export interface ConfirmInstallmentRequest {
  transactionId: string;
  confirmAmount?: number; // NULLの場合は既存金額を使用
}

/** 分納削除リクエスト */
export interface DeleteInstallmentRequest {
  transactionId: string;
  forceDelete?: boolean;
}

// ===============================================================
// 4. エラーハンドリング型定義
// ===============================================================

/** 標準化されたAPIエラー */
export class InstallmentError extends Error {
  constructor(
    public readonly code: InstallmentErrorCode,
    public readonly message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'InstallmentError';
  }
  
  /** エラーがユーザー修正可能かどうか */
  get isUserFixable(): boolean {
    return ['INVALID_AMOUNT', 'AMOUNT_EXCEEDED'].includes(this.code);
  }
  
  /** エラーが再試行可能かどうか */
  get isRetryable(): boolean {
    return ['NETWORK_ERROR', 'UNKNOWN_ERROR'].includes(this.code);
  }
}

/** 操作結果の統一型 */
export type OperationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: InstallmentError };

// ===============================================================
// 5. React Hook用型定義
// ===============================================================

/** 分納管理フックの状態 */
export interface InstallmentHookState {
  isLoading: boolean;
  error: InstallmentError | null;
  data: OrderInstallmentSummaryResponse | null;
  refetch: () => Promise<void>;
}

/** 分納作成フックの状態 */
export interface CreateInstallmentHookState {
  isCreating: boolean;
  createError: InstallmentError | null;
  createInstallment: (request: CreateInstallmentRequest) => Promise<OperationResult<AddInstallmentV2Response>>;
}

// ===============================================================
// 6. 設定とデフォルト値
// ===============================================================

/** 分納関連の設定定数 */
export const INSTALLMENT_CONFIG = {
  /** デフォルト支払期日（日後） */
  DEFAULT_DUE_DAYS: 30,
  /** 最大分納回数 */
  MAX_INSTALLMENTS: 50,
  /** 最小分納金額 */
  MIN_AMOUNT: 1,
  /** 最大リトライ回数 */
  MAX_RETRIES: 3,
  /** リトライ間隔（ミリ秒） */
  RETRY_DELAY_MS: 1000,
} as const;

/** 分納ステータスの日本語表示マッピング */
export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  draft: '未確定',
  confirmed: '確定',
  cancelled: 'キャンセル',
  completed: '完了',
} as const;

/** エラーコードの日本語表示マッピング */
export const INSTALLMENT_ERROR_LABELS: Record<InstallmentErrorCode, string> = {
  SUCCESS: '成功',
  ORDER_NOT_FOUND: '発注が見つかりません',
  INVALID_AMOUNT: '無効な金額です',
  AMOUNT_EXCEEDED: '分納合計が発注金額を超過しています',
  TRANSACTION_NOT_FOUND: '取引が見つかりません',
  ALREADY_CONFIRMED: '既に確定済みです',
  CANNOT_DELETE_CONFIRMED: '確定済みの分納は削除できません',
  VALIDATION_FAILED: 'バリデーションに失敗しました',
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  UNKNOWN_ERROR: '不明なエラーが発生しました',
} as const;

// ===============================================================
// 7. 型ガード関数
// ===============================================================

/** AddInstallmentV2Responseの型ガード */
export function isAddInstallmentV2Response(obj: any): obj is AddInstallmentV2Response {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.success === 'boolean' &&
    typeof obj.parent_order_id === 'string' &&
    typeof obj.status === 'string' &&
    typeof obj.total_amount === 'number' &&
    typeof obj.validation_info === 'object'
  );
}

/** InstallmentErrorの型ガード */
export function isInstallmentError(obj: any): obj is InstallmentError {
  return obj instanceof InstallmentError;
}

/** ValidationResultの型ガード */
export function isValidationResult(obj: any): obj is ValidationResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.isValid === 'boolean' &&
    typeof obj.errorCode === 'string' &&
    typeof obj.errorMessage === 'string' &&
    typeof obj.orderTotal === 'number' &&
    typeof obj.allocatedTotal === 'number' &&
    typeof obj.remainingAmount === 'number'
  );
}

// ===============================================================
// 8. 型安全性ヘルパー関数
// ===============================================================

/** 安全な数値変換 */
export function safeParseNumber(value: unknown, defaultValue = 0): number {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? defaultValue : num;
}

/** 安全なステータス変換 */
export function parseInstallmentStatus(value: unknown): InstallmentStatus {
  if (typeof value === 'string' && ['draft', 'confirmed', 'cancelled', 'completed'].includes(value)) {
    return value as InstallmentStatus;
  }
  return 'draft'; // デフォルトステータス
}

/** 日付文字列の検証 */
export function isValidDateString(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}