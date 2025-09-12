// ===============================================================
// 🎣 Phase 3: useInstallmentService - 型安全なReact Hooks
// ===============================================================
// 目的: InstallmentServiceを活用した完全型安全なReact統合

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

import { installmentService } from '../services/InstallmentService';
import type {
  CreateInstallmentRequest,
  ConfirmInstallmentRequest,
  DeleteInstallmentRequest,
  OrderInstallmentSummaryResponse,
  AddInstallmentV2Response,
  InstallmentError,
  OperationResult,
  InstallmentHookState,
  CreateInstallmentHookState,
} from '../types/installment';
import { INSTALLMENT_ERROR_LABELS } from '../types/installment';

// ===============================================================
// 1. 発注サマリー管理フック
// ===============================================================

/**
 * 発注の分納サマリーを管理するフック
 */
export function useOrderInstallmentSummary(orderId: string | null): InstallmentHookState {
  const queryResult = useQuery<OperationResult<OrderInstallmentSummaryResponse>, Error>({
    queryKey: ['order-installment-summary', orderId],
    queryFn: () => installmentService.getOrderSummary(orderId!),
    enabled: !!orderId,
    staleTime: 30 * 1000,       // 30秒
    gcTime: 2 * 60 * 1000,      // 2分
    refetchOnWindowFocus: false,
    retry: (failureCount, _error) => {
      // リトライ可能エラーの場合のみリトライ
      return failureCount < 2;
    },
  });
  
  const [error, setError] = useState<InstallmentError | null>(null);
  
  // エラー状態の管理
  React.useEffect(() => {
    if (queryResult.data && !queryResult.data.success) {
      setError(queryResult.data.error);
    } else if (queryResult.error) {
      setError(new InstallmentError('NETWORK_ERROR', queryResult.error.message));
    } else {
      setError(null);
    }
  }, [queryResult.data, queryResult.error]);
  
  const refetch = useCallback(async () => {
    setError(null);
    await queryResult.refetch();
  }, [queryResult]);
  
  return {
    isLoading: queryResult.isLoading,
    error,
    data: queryResult.data?.success ? queryResult.data.data : null,
    refetch,
  };
}

// ===============================================================
// 2. 分納作成フック
// ===============================================================

/**
 * 分納作成を管理するフック
 */
export function useCreateInstallment(): CreateInstallmentHookState {
  const queryClient = useQueryClient();
  const [createError, setCreateError] = useState<InstallmentError | null>(null);
  
  const mutation = useMutation<
    OperationResult<AddInstallmentV2Response>,
    Error,
    CreateInstallmentRequest
  >({
    mutationFn: installmentService.createInstallment.bind(installmentService),
    onSuccess: (result, variables) => {
      if (result.success) {
        // 成功時の処理
        const data = result.data;
        toast.success(
          `分納を${data.status === 'confirmed' ? '確定で' : '未確定で'}作成しました（¥${data.total_amount.toLocaleString()}）`
        );
        
        // 関連するクエリキャッシュを無効化
        queryClient.invalidateQueries({ 
          queryKey: ['order-installment-summary', variables.parentOrderId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['purchase-orders'] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['transactions'] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['dashboard'] 
        });
        
        setCreateError(null);
      } else {
        // 失敗時の処理
        setCreateError(result.error);
        
        // ユーザー修正可能エラーの場合は詳細トースト
        if (result.error.isUserFixable) {
          toast.error(result.error.message, { duration: 5000 });
        } else {
          toast.error(`分納作成に失敗しました: ${result.error.message}`);
        }
      }
    },
    onError: (_error) => {
      const installmentError = new InstallmentError(
        'NETWORK_ERROR',
        'ネットワークエラーが発生しました',
        { originalError: error }
      );
      setCreateError(installmentError);
      toast.error('通信エラーが発生しました。再度お試しください。');
    },
  });
  
  const createInstallment = useCallback(
    async (request: CreateInstallmentRequest): Promise<OperationResult<AddInstallmentV2Response>> => {
      setCreateError(null);
      const result = await mutation.mutateAsync(request);
      return result;
    },
    [mutation]
  );
  
  return {
    isCreating: mutation.isPending,
    createError,
    createInstallment,
  };
}

// ===============================================================
// 3. 分納確定フック
// ===============================================================

/**
 * 分納確定を管理するフック
 */
export function useConfirmInstallment() {
  const queryClient = useQueryClient();
  
  return useMutation<
    OperationResult<any>,
    Error,
    ConfirmInstallmentRequest & { orderId: string }
  >({
    mutationFn: async ({ orderId: _orderId, ...request }) => {
      return installmentService.confirmInstallment(request);
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        const data = result.data;
        toast.success(
          `分納を確定しました（¥${data.confirmed_amount.toLocaleString()}）`
        );
        
        // キャッシュ無効化
        queryClient.invalidateQueries({ 
          queryKey: ['order-installment-summary', variables.orderId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['purchase-orders'] 
        });
      } else {
        toast.error(`確定に失敗しました: ${result.error.message}`);
      }
    },
    onError: (_error) => {
      toast.error('通信エラーが発生しました。再度お試しください。');
    },
  });
}

// ===============================================================
// 4. 分納削除フック
// ===============================================================

/**
 * 分納削除を管理するフック
 */
export function useDeleteInstallment() {
  const queryClient = useQueryClient();
  
  return useMutation<
    OperationResult<any>,
    Error,
    DeleteInstallmentRequest & { orderId: string }
  >({
    mutationFn: async ({ orderId: _orderId, ...request }) => {
      return installmentService.deleteInstallment(request);
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        const data = result.data;
        toast.success(
          `分納を削除しました（¥${data.deleted_amount?.toLocaleString() || '0'}）`
        );
        
        // キャッシュ無効化
        queryClient.invalidateQueries({ 
          queryKey: ['order-installment-summary', variables.orderId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['purchase-orders'] 
        });
      } else {
        toast.error(`削除に失敗しました: ${result.error.message}`);
      }
    },
    onError: (_error) => {
      toast.error('通信エラーが発生しました。再度お試しください。');
    },
  });
}

// ===============================================================
// 5. リアルタイム残額計算フック
// ===============================================================

/**
 * リアルタイムで残額を計算するフック
 */
export function useRemainingAmountCalculator(
  orderId: string | null,
  proposedAmount: number = 0
) {
  const { data: summary, error } = useOrderInstallmentSummary(orderId);
  
  return React.useMemo(() => {
    if (!summary || error) {
      return {
        currentRemaining: 0,
        afterAddition: 0,
        isValid: false,
        canAdd: false,
        errorMessage: error?.message || '発注情報を取得できません',
      };
    }
    
    const afterAddition = summary.remaining_amount - proposedAmount;
    const isValid = proposedAmount > 0 && afterAddition >= 0;
    
    return {
      currentRemaining: summary.remaining_amount,
      afterAddition: Math.max(0, afterAddition),
      isValid,
      canAdd: summary.summary_info.can_add_installment && isValid,
      errorMessage: !isValid ? '金額が残額を超えています' : null,
    };
  }, [summary, error, proposedAmount]);
}

// ===============================================================
// 6. 分納履歴管理フック
// ===============================================================

/**
 * 分納履歴をリアルタイム管理するフック
 */
export function useInstallmentHistory(orderId: string | null) {
  const { data: summary, isLoading, error, refetch } = useOrderInstallmentSummary(orderId);
  
  const installments = React.useMemo(() => {
    return summary?.installments || [];
  }, [summary]);
  
  // 統計情報の計算
  const stats = React.useMemo(() => {
    if (!summary) return null;
    
    const confirmed = installments.filter(i => i.status === 'confirmed');
    const draft = installments.filter(i => i.status === 'draft');
    
    return {
      total: installments.length,
      confirmed: confirmed.length,
      draft: draft.length,
      confirmedAmount: confirmed.reduce((sum, i) => sum + i.amount, 0),
      draftAmount: draft.reduce((sum, i) => sum + i.amount, 0),
      completionRate: summary.completion_rate,
      remainingAmount: summary.remaining_amount,
    };
  }, [installments, summary]);
  
  return {
    installments,
    stats,
    isLoading,
    error,
    refetch,
  };
}

// ===============================================================
// 7. エラー処理ヘルパーフック
// ===============================================================

/**
 * エラーメッセージを日本語化するフック
 */
export function useInstallmentErrorHandler() {
  const formatError = useCallback((error: InstallmentError): string => {
    const baseMessage = INSTALLMENT_ERROR_LABELS[error.code] || error.message;
    
    // 詳細情報がある場合は追加
    if (error.details && typeof error.details === 'object') {
      const details = error.details;
      if (details.remaining_amount !== undefined && details.order_total !== undefined) {
        return `${baseMessage}（残額: ¥${details.remaining_amount.toLocaleString()}, 発注額: ¥${details.order_total.toLocaleString()}）`;
      }
    }
    
    return baseMessage;
  }, []);
  
  const showError = useCallback((error: InstallmentError) => {
    const message = formatError(error);
    if (error.isUserFixable) {
      toast.error(message, { duration: 6000 });
    } else {
      toast.error(message);
    }
  }, [formatError]);
  
  return {
    formatError,
    showError,
  };
}

// ===============================================================
// 8. React import（TypeScript対応）
// ===============================================================

import React from 'react';