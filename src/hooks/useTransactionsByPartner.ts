// src/hooks/useTransactionsByPartner.ts - PostgREST最適化版
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TransactionWithManager, TransactionFilters } from '../utils/format';
import { 
  createSafeSearchQuery, 
  executeSafeQuery, 
  isValidUUID,
  createDateRangeCondition,
  combineSearchConditions 
} from '../utils/queryHelpers';


export function useTransactionsByPartner(
  partnerId: string | null, 
  searchKeyword: string,
  filters?: TransactionFilters
) {
  return useQuery<TransactionWithManager[]> ({
    queryKey: ['transactions', partnerId, searchKeyword, filters],
    enabled: true,
    staleTime: 10 * 1000,
    gcTime: 30 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      let query = supabase
        .from('transactions') // 基本のtransactionsテーブルを使用
        .select(`
          id, transaction_no, transaction_type,
          partner_id, transaction_date, due_date,
          status, total_amount, parent_order_id,
          memo,
          created_at
        `)
        .order('created_at', { ascending: false });

      // 仕入先フィルタリング
      if (partnerId && partnerId !== 'all-partners') {
        query = query.eq('partner_id', partnerId);
      }

      // PostgREST準拠の安全な検索
      if (searchKeyword && searchKeyword.trim()) {
        const textSearchQuery = createSafeSearchQuery(
          searchKeyword,
          ['memo', 'transaction_no'], // テキストカラム
          [], // 数値カラム
          [] // 日付カラム
        );
        
        const idSearchQuery = isValidUUID(searchKeyword.trim()) 
          ? `id.eq.${searchKeyword.trim()}`
          : '';
        
        const combinedQuery = combineSearchConditions(textSearchQuery, idSearchQuery);
        
        if (combinedQuery) {
          query = query.or(combinedQuery);
        }
      }

      // 新規フィルター条件の適用
      if (filters) {
        // 金額フィルター
        if (typeof filters.minAmount === 'number') {
          query = query.gte('total_amount', filters.minAmount);
        }
        if (typeof filters.maxAmount === 'number') {
          query = query.lte('total_amount', filters.maxAmount);
        }

        // ステータスフィルター
        if (filters.status && filters.status !== 'all') {
          if (filters.status === 'confirmed') {
            query = query.eq('status', 'confirmed');
          } else if (filters.status === 'draft') {
            query = query.neq('status', 'confirmed');
          }
        }

        // 作成日フィルター (安全な日付範囲処理)
        const dateCondition = createDateRangeCondition(
          'created_at', 
          filters.startDate, 
          filters.endDate
        );
        
        if (dateCondition) {
          const dateConditions = dateCondition.split(',');
          dateConditions.forEach(condition => {
            const [field, operator, value] = condition.split('.');
            if (operator === 'gte') {
              query = query.gte(field, value);
            } else if (operator === 'lt') {
              query = query.lt(field, value);
            }
          });
        }

        // 発注担当者フィルター（暫定的に無効化）
        // if (filters.orderManagerId) {
        //   // 担当者フィルタリング機能は後で実装
        // }
      }

      // parent_order_idが設定されている取引のみを取得
      query = query.not('parent_order_id', 'is', null);

      // 安全なクエリ実行
      return await executeSafeQuery(query, []);
    },
  });
}