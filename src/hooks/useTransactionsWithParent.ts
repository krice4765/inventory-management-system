// src/hooks/useTransactionsWithParent.ts - PostgREST最適化版
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createSafeSearchQuery, executeSafeQuery } from '../utils/queryHelpers';

interface Transaction {
  id: string;
  parent_order_id: string | null;
  product_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  status: string;
  created_at: string;
  memo: string | null;
  installment_no?: number;
}

// 発注残額計算ヘルパー関数
export function calculateRemainingAmount(
  orderTotal: number,
  transactions: Transaction[]
): number {
  const allocatedTotal = transactions
    .filter(t => t.total_amount && t.total_amount > 0)
    .reduce((sum, t) => sum + (t.total_amount || 0), 0);
  
  return Math.max(0, orderTotal - allocatedTotal);
}

export function useTransactionsWithParent(
  parentOrderId: string | null, 
  searchKeyword: string = ''
) {
  return useQuery<Transaction[]>({
    queryKey: ['transactionsWithParent', parentOrderId, searchKeyword],
    enabled: !!parentOrderId,
    staleTime: 60 * 1000,        // 1分
    gcTime: 5 * 60 * 1000,       // 5分（v5: cacheTime → gcTime）
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!parentOrderId) {
        return [];
      }

      try {
        // Supabaseクライアントを使用した安全なデータ取得
        let query = supabase
          .from('transactions')
          .select('id,parent_order_id,product_name,quantity,unit_price,total_amount,status,created_at,memo,installment_no')
          .eq('parent_order_id', parentOrderId)
          .order('created_at', { ascending: false })
          .limit(100);

        // PostgREST準拠の安全な検索
        const keyword = searchKeyword?.trim();
        if (keyword) {
          const searchQuery = createSafeSearchQuery(
            keyword,
            ['product_name', 'memo'], // テキストカラム
            [], // 数値カラム
            [] // 日付カラム
          );
          
          if (searchQuery) {
            query = query.or(searchQuery);
          }
        }

        // 安全なクエリ実行
        return await executeSafeQuery(query, []);
      } catch (error) {
        console.error('Transaction fetch error:', error);
        throw error;
      }
    },
  });
}
