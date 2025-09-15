// システム整合性チェック用カスタムフック
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IntegrityService } from '../services/integrityService';
import {
  IntegrityCheckResult,
  IntegrityCheckSummary,
  IntegrityCheckConfig,
  IntegrityCheckCategory
} from '../types/integrity';

const integrityService = new IntegrityService();

/**
 * システム整合性チェックのメインフック
 */
export const useSystemIntegrity = (config?: Partial<IntegrityCheckConfig>) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{
    currentCategory?: IntegrityCheckCategory;
    completedCategories: number;
    totalCategories: number;
  }>({
    completedCategories: 0,
    totalCategories: 6 // financial, inventory, delivery, reference, business_rule, data_quality
  });

  const queryClient = useQueryClient();

  // 完全な整合性チェックを実行
  const runCompleteCheck = useMutation({
    mutationFn: async () => {
      setIsRunning(true);
      setProgress({ completedCategories: 0, totalCategories: 6 });

      try {
        const service = config ? new IntegrityService(config) : integrityService;
        const result = await service.runCompleteIntegrityCheck();

        // キャッシュを更新
        queryClient.setQueryData(['integrity-summary'], result.summary);
        queryClient.setQueryData(['integrity-results'], result.results);

        return result;
      } finally {
        setIsRunning(false);
        setProgress({ completedCategories: 6, totalCategories: 6 });
      }
    },
    onSuccess: () => {
      // 関連するクエリを無効化して再取得を促す
      queryClient.invalidateQueries({ queryKey: ['integrity'] });
    }
  });

  // 特定カテゴリのチェックを実行
  const runCategoryCheck = useMutation({
    mutationFn: async (category: IntegrityCheckCategory) => {
      const service = config ? new IntegrityService(config) : integrityService;
      return service.runCategoryCheck(category);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrity'] });
    }
  });

  // 最新の整合性サマリーを取得
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary
  } = useQuery<IntegrityCheckSummary>({
    queryKey: ['integrity-summary'],
    queryFn: async () => {
      const result = await integrityService.runCompleteIntegrityCheck();
      return result.summary;
    },
    staleTime: 5 * 60 * 1000, // 5分間はフレッシュとみなす
    cacheTime: 10 * 60 * 1000, // 10分間キャッシュを保持
    refetchOnWindowFocus: false
  });

  // 詳細な整合性チェック結果を取得
  const {
    data: results,
    isLoading: resultsLoading,
    error: resultsError,
    refetch: refetchResults
  } = useQuery<IntegrityCheckResult[]>({
    queryKey: ['integrity-results'],
    queryFn: async () => {
      const result = await integrityService.runCompleteIntegrityCheck();
      return result.results;
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // 手動でチェックを実行
  const executeCheck = useCallback(async () => {
    return runCompleteCheck.mutate();
  }, [runCompleteCheck]);

  // 特定カテゴリのチェックを実行
  const executeCategoryCheck = useCallback(async (category: IntegrityCheckCategory) => {
    return runCategoryCheck.mutate(category);
  }, [runCategoryCheck]);

  // 整合性データをリフレッシュ
  const refreshData = useCallback(() => {
    refetchSummary();
    refetchResults();
  }, [refetchSummary, refetchResults]);

  return {
    // データ
    summary,
    results,

    // ローディング状態
    isLoading: summaryLoading || resultsLoading,
    isRunning,
    progress,

    // エラー
    error: summaryError || resultsError,

    // 実行中状態
    isExecuting: runCompleteCheck.isPending || runCategoryCheck.isPending,

    // アクション
    executeCheck,
    executeCategoryCheck,
    refreshData,

    // ミューテーション状態
    checkMutation: runCompleteCheck,
    categoryMutation: runCategoryCheck
  };
};

/**
 * 整合性サマリーのみを取得する軽量フック
 */
export const useIntegritySummary = () => {
  const { data, isLoading, error, refetch } = useQuery<IntegrityCheckSummary>({
    queryKey: ['integrity-summary-only'],
    queryFn: async () => {
      const service = new IntegrityService({
        enabled_categories: ['financial', 'inventory', 'delivery'],
        include_sample_data: false,
        max_sample_records: 0,
        timeout_ms: 15000
      });
      const result = await service.runCompleteIntegrityCheck();
      return result.summary;
    },
    staleTime: 10 * 60 * 1000, // 10分間はフレッシュ
    cacheTime: 15 * 60 * 1000, // 15分間キャッシュ
    refetchOnWindowFocus: false
  });

  return {
    summary: data,
    isLoading,
    error,
    refetch
  };
};

/**
 * 特定カテゴリの結果のみを取得するフック
 */
export const useCategoryIntegrity = (category: IntegrityCheckCategory) => {
  const { data, isLoading, error, refetch } = useQuery<IntegrityCheckResult[]>({
    queryKey: ['integrity-category', category],
    queryFn: async () => {
      const service = new IntegrityService();
      return service.runCategoryCheck(category);
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  return {
    results: data,
    isLoading,
    error,
    refetch
  };
};

/**
 * リアルタイム監視用フック（定期的に軽量チェックを実行）
 */
export const useIntegrityMonitoring = (intervalMinutes: number = 30) => {
  const { data, isLoading, error } = useQuery<IntegrityCheckSummary>({
    queryKey: ['integrity-monitoring'],
    queryFn: async () => {
      const service = new IntegrityService({
        enabled_categories: ['financial', 'delivery'], // 重要なカテゴリのみ
        include_sample_data: false,
        max_sample_records: 0,
        timeout_ms: 10000
      });
      const result = await service.runCompleteIntegrityCheck();
      return result.summary;
    },
    refetchInterval: intervalMinutes * 60 * 1000, // 指定された間隔で自動更新
    staleTime: (intervalMinutes - 5) * 60 * 1000, // 間隔より少し短めでstale判定
    cacheTime: intervalMinutes * 2 * 60 * 1000, // 間隔の2倍の時間キャッシュ
    refetchOnWindowFocus: false
  });

  return {
    summary: data,
    isMonitoring: !isLoading,
    error,
    lastCheck: data?.last_check_at,
    overallStatus: data?.overall_status
  };
};