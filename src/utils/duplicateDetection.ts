// ブラウザ環境でのcrypto使用
import { supabase } from '../lib/supabase';

export interface DuplicateDetectionData {
  orderId: string;
  amount: number;
  deliveryType: string;
  quantities?: { [productId: string]: number };
  userId: string;
  sessionId: string;
}

export interface DuplicateRecord {
  id: string;
  operation_hash: string;
  resource_id: string;
  session_id: string;
  created_at: string;
  expires_at: string;
  metadata: any;
  operation_type: string;
  is_valid: boolean;
}

// ハッシュベースの重複検出システム
export class DuplicateDetectionService {
  private static readonly EXPIRY_MINUTES = 60; // 1時間でハッシュを無効化

  /**
   * 操作データからハッシュを生成（ブラウザ対応）
   */
  static async generateOperationHash(data: DuplicateDetectionData): Promise<string> {
    // 操作の一意性を決定する要素を組み合わせ
    const hashInput = {
      orderId: data.orderId,
      amount: Math.round(data.amount), // 小数点以下の誤差を排除
      deliveryType: data.deliveryType,
      quantities: data.quantities ? Object.entries(data.quantities).sort() : null,
      userId: data.userId,
    };

    const inputString = JSON.stringify(hashInput);

    // ブラウザのWeb Crypto APIを使用
    const encoder = new TextEncoder();
    const data_buf = encoder.encode(inputString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data_buf);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 重複チェックと記録の挿入
   */
  static async checkAndRecordOperation(data: DuplicateDetectionData): Promise<{
    isDuplicate: boolean;
    operationHash: string;
    duplicateRecord?: DuplicateRecord;
  }> {
    const operationHash = await this.generateOperationHash(data);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.EXPIRY_MINUTES * 60 * 1000);

    try {
      // 1. 既存の同一ハッシュ操作をチェック（期限内のみ）
      const { data: existingRecord, error: checkError } = await supabase
        .from('duplicate_detection_records')
        .select('*')
        .eq('operation_hash', operationHash)
        .gt('expires_at', now.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (checkError) {
        console.error('重複チェックエラー:', checkError);
        // エラー時は安全側に寄せて重複として扱わない
        return { isDuplicate: false, operationHash };
      }

      if (existingRecord && existingRecord.length > 0) {
          hash: operationHash,
          existingRecord: existingRecord[0],
          timeDiff: now.getTime() - new Date(existingRecord[0].created_at).getTime()
        });

        return {
          isDuplicate: true,
          operationHash,
          duplicateRecord: existingRecord[0] as DuplicateRecord
        };
      }

      // 2. 新しい操作レコードを挿入
      const { error: insertError } = await supabase
        .from('duplicate_detection_records')
        .insert({
          session_id: data.sessionId,
          operation_hash: operationHash,
          operation_type: 'transaction_creation',
          resource_id: data.orderId,
          expires_at: expiresAt.toISOString(),
          metadata: {
            userId: data.userId,
            orderId: data.orderId,
            operation_data: data
          }
        });

      if (insertError) {
        console.error('重複検出記録挿入エラー:', insertError);
        // 挿入失敗時も安全側に寄せる
        return { isDuplicate: false, operationHash };
      }

      return { isDuplicate: false, operationHash };

    } catch (error) {
      console.error('重複検出処理エラー:', error);
      return { isDuplicate: false, operationHash };
    }
  }

  /**
   * 期限切れレコードのクリーンアップ
   */
  static async cleanupExpiredRecords(): Promise<void> {
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('duplicate_detection_records')
        .delete()
        .lt('expires_at', now);

      if (error) {
        console.error('期限切れレコードクリーンアップエラー:', error);
      } else {
      }
    } catch (error) {
      console.error('クリーンアップ処理エラー:', error);
    }
  }

  /**
   * セッション終了時の操作レコード無効化
   */
  static async invalidateSessionOperations(sessionId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('duplicate_detection_records')
        .update({ expires_at: now })
        .eq('session_id', sessionId)
        .gt('expires_at', now);

      if (error) {
        console.error('セッション操作無効化エラー:', error);
      } else {
      }
    } catch (error) {
      console.error('セッション無効化処理エラー:', error);
    }
  }
}

// Hook for React components
export function useDuplicateDetection() {
  const generateSessionId = (): string => {
    return globalThis.crypto.randomUUID();
  };

  const checkDuplicate = async (data: DuplicateDetectionData) => {
    return await DuplicateDetectionService.checkAndRecordOperation(data);
  };

  const cleanup = async () => {
    return await DuplicateDetectionService.cleanupExpiredRecords();
  };

  const invalidateSession = async (sessionId: string) => {
    return await DuplicateDetectionService.invalidateSessionOperations(sessionId);
  };

  return {
    generateSessionId,
    checkDuplicate,
    cleanup,
    invalidateSession,
  };
}