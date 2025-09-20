import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  createIntegratedInstallment,
  validateIntegration,
  repairInstallmentInventoryLink,
  type IntegratedInstallmentParams
} from '../api/inventory-integration';

export interface UseIntegratedInstallmentOptions {
  parentOrderId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useIntegratedInstallment(options: UseIntegratedInstallmentOptions) {
  const queryClient = useQueryClient();
  const { parentOrderId, onSuccess, onError } = options;

  // 統合状況の監視
  const validationQuery = useQuery({
    queryKey: ['integration-validation', parentOrderId],
    queryFn: () => validateIntegration(parentOrderId),
    refetchInterval: 30000, // 30秒ごとに自動チェック
    enabled: !!parentOrderId,
  });

  // 統合分納作成
  const createMutation = useMutation({
    mutationFn: (params: IntegratedInstallmentParams) => createIntegratedInstallment(params),
    onSuccess: (result) => {
      if (result.integrationStatus === 'success') {
        toast.success('✅ 分納と在庫移動の連携が完了しました');

        // 関連するキャッシュを更新
        queryClient.invalidateQueries({ queryKey: ['integration-validation'] });
        queryClient.invalidateQueries({ queryKey: ['delivery-history'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });

        onSuccess?.();
      } else if (result.integrationStatus === 'partial') {
        toast.error('⚠️ 分納は作成されましたが、在庫移動の連携に問題があります');
        console.error('部分的な失敗:', result.errors);
        onError?.(new Error('部分的な連携失敗'));
      } else {
        toast.error('❌ 統合分納の作成に失敗しました');
        console.error('完全な失敗:', result.errors);
        onError?.(new Error('統合分納作成失敗'));
      }
    },
    onError: (error) => {
      toast.error(`❌ 分納作成エラー: ${error.message}`);
      onError?.(error);
    },
  });

  // 修復機能
  const repairMutation = useMutation({
    mutationFn: ({ transactionId, products }: {
      transactionId: string;
      products: Array<{ productId: string; quantity: number; unitPrice: number; }>;
    }) => repairInstallmentInventoryLink(transactionId, products),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('🔧 在庫移動の修復が完了しました');
        queryClient.invalidateQueries({ queryKey: ['integration-validation'] });
      } else {
        toast.error('❌ 修復に失敗しました');
        console.error('修復エラー:', result.errors);
      }
    },
    onError: (error) => {
      toast.error(`❌ 修復エラー: ${error.message}`);
    },
  });

  // 統合分納作成のヘルパー関数
  const createInstallment = async (params: {
    amount: number;
    products?: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>;
    memo?: string;
    dueDate?: string;
  }) => {
    // 商品情報が提供されていない場合、発注書から推測
    let finalProducts = params.products;

    if (!finalProducts || finalProducts.length === 0) {
      // デフォルトの商品情報を作成（実際の発注書から取得するロジックを後で追加）
      finalProducts = [
        {
          productId: 'default-product-id',
          quantity: 1,
          unitPrice: params.amount, // 金額から単価を推測
        }
      ];
    }

    const integrationParams: IntegratedInstallmentParams = {
      parentOrderId,
      amount: params.amount,
      products: finalProducts,
      memo: params.memo,
      dueDate: params.dueDate,
    };

    return createMutation.mutateAsync(integrationParams);
  };

  // 自動修復機能
  const autoRepair = async () => {
    if (!validationQuery.data || validationQuery.data.isValid) {
      return;
    }

    const missingInventoryIssues = validationQuery.data.issues.filter(
      issue => issue.type === 'missing_inventory' && issue.transactionId
    );

    for (const issue of missingInventoryIssues) {
      if (issue.transactionId) {
        await repairMutation.mutateAsync({
          transactionId: issue.transactionId,
          products: [
            {
              productId: 'repair-product-id',
              quantity: 1,
              unitPrice: 1000, // デフォルト値
            }
          ]
        });
      }
    }
  };

  return {
    // データ
    validation: validationQuery.data,
    validationLoading: validationQuery.isLoading,
    validationError: validationQuery.error,

    // 操作
    createInstallment,
    autoRepair,

    // 状態
    isCreating: createMutation.isPending,
    isRepairing: repairMutation.isPending,

    // 統計
    hasIssues: validationQuery.data ? !validationQuery.data.isValid : false,
    issueCount: validationQuery.data?.issues.length || 0,

    // 直接アクセス（高度な使用）
    createMutation,
    repairMutation,
  };
}

// 発注書に統合機能を追加するための簡単なhook
export function useOrderIntegrationStatus(parentOrderId: string) {
  return useQuery({
    queryKey: ['integration-validation', parentOrderId],
    queryFn: () => validateIntegration(parentOrderId),
    enabled: !!parentOrderId,
    refetchInterval: 60000, // 1分ごと
  });
}