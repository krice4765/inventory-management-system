// 改良された重複検出システム - アトミック操作とレース条件対応
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

// 改良された重複検出サービス
export class ImprovedDuplicateDetectionService {
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
      // sessionIdは含めない - 同じ操作は異なるセッションでも重複と見なす
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
   * 重複チェックと記録の挿入（アトミック操作）
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
      console.log('🔍 重複チェック開始:', {
        hash: operationHash.substring(0, 16) + '...',
        orderId: data.orderId
      });

      // RPC関数を使用してアトミックな重複チェックと挿入を実行
      const { data: result, error: rpcError } = await supabase.rpc(
        'check_and_insert_duplicate_detection',
        {
          p_operation_hash: operationHash,
          p_session_id: data.sessionId,
          p_operation_type: 'transaction_creation',
          p_resource_id: data.orderId,
          p_expires_at: expiresAt.toISOString(),
          p_metadata: {
            userId: data.userId,
            orderId: data.orderId,
            operation_data: data
          }
        }
      );

      if (rpcError) {
        console.error('❌ RPC関数エラー:', rpcError);
        // フォールバック：従来の方法で処理
        return await this.fallbackCheckAndRecord(data, operationHash, expiresAt);
      }

      console.log('✅ RPC結果:', result);

      if (result && result.is_duplicate) {
        console.log('🚨 重複操作検出 (RPC):', {
          hash: operationHash.substring(0, 16) + '...',
          orderId: data.orderId
        });

        return {
          isDuplicate: true,
          operationHash,
          duplicateRecord: result.existing_record as DuplicateRecord
        };
      }

      console.log('✅ 新規操作記録 (RPC):', {
        hash: operationHash.substring(0, 16) + '...',
        orderId: data.orderId
      });

      return { isDuplicate: false, operationHash };

    } catch (error) {
      console.error('❌ 重複検出処理エラー:', error);
      // エラー時はフォールバック処理を実行
      return await this.fallbackCheckAndRecord(data, operationHash, expiresAt);
    }
  }

  /**
   * フォールバック処理：RPC関数が利用できない場合の従来の方法
   */
  private static async fallbackCheckAndRecord(
    data: DuplicateDetectionData,
    operationHash: string,
    expiresAt: Date
  ): Promise<{
    isDuplicate: boolean;
    operationHash: string;
    duplicateRecord?: DuplicateRecord;
  }> {
    console.log('⚠️ フォールバック処理を実行');
    const now = new Date();

    try {
      // 1. 既存の同一ハッシュ操作をチェック（期限内のみ）
      const { data: existingRecord, error: checkError } = await supabase
        .from('duplicate_detection_records')
        .select('*')
        .eq('operation_hash', operationHash)
        .gt('expires_at', now.toISOString())
        .eq('is_valid', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (checkError) {
        console.error('❌ 重複チェックエラー:', checkError);
        // エラー時は安全側に寄せて重複として扱わない
        return { isDuplicate: false, operationHash };
      }

      if (existingRecord && existingRecord.length > 0) {
        console.log('🚨 重複操作検出 (フォールバック):', {
          hash: operationHash.substring(0, 16) + '...',
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
          },
          is_valid: true
        });

      if (insertError) {
        console.error('❌ 重複検出記録挿入エラー:', insertError);
        // 挿入失敗時は重複として扱う（安全側）
        return { isDuplicate: true, operationHash };
      }

      console.log('✅ 新規操作記録 (フォールバック):', {
        hash: operationHash.substring(0, 16) + '...',
        orderId: data.orderId
      });

      return { isDuplicate: false, operationHash };

    } catch (error) {
      console.error('❌ フォールバック処理エラー:', error);
      return { isDuplicate: true, operationHash }; // 安全側に寄せる
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
        console.error('❌ 期限切れレコードクリーンアップエラー:', error);
      } else {
        console.log('✅ 期限切れレコードクリーンアップ完了');
      }
    } catch (error) {
      console.error('❌ クリーンアップ処理エラー:', error);
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
        .update({ is_valid: false, expires_at: now })
        .eq('session_id', sessionId)
        .gt('expires_at', now);

      if (error) {
        console.error('❌ セッション操作無効化エラー:', error);
      } else {
        console.log('✅ セッション操作無効化完了:', sessionId);
      }
    } catch (error) {
      console.error('❌ セッション無効化処理エラー:', error);
    }
  }
}

// Hook for React components
export function useImprovedDuplicateDetection() {
  const generateSessionId = (): string => {
    return globalThis.crypto.randomUUID();
  };

  const checkDuplicate = async (data: DuplicateDetectionData) => {
    return await ImprovedDuplicateDetectionService.checkAndRecordOperation(data);
  };

  const cleanup = async () => {
    return await ImprovedDuplicateDetectionService.cleanupExpiredRecords();
  };

  const invalidateSession = async (sessionId: string) => {
    return await ImprovedDuplicateDetectionService.invalidateSessionOperations(sessionId);
  };

  return {
    generateSessionId,
    checkDuplicate,
    cleanup,
    invalidateSession,
  };
}