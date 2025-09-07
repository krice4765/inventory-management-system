// src/hooks/useTransactionsByPartner.ts - 完全版
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TransactionWithManager, TransactionFilters } from '../utils/format';


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

      // 9軸統合検索（UUID安全版）
      if (searchKeyword && searchKeyword.trim()) {
        const raw = searchKeyword.trim();
        const k = `%${raw}%`;
        
        // UUID形式チェック
        const isValidUUID = (str: string): boolean => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return uuidRegex.test(str);
        };
        
        const searchConditions = [
          `memo.ilike.${k}`,                   // 取引メモ
          `transaction_no.ilike.${k}`          // 取引番号（部分一致）
        ];
        
        // UUID形式の場合のみID検索を追加
        if (isValidUUID(raw)) {
          searchConditions.push(`id.eq.${raw}`);
        }
        
        query = query.or(searchConditions.join(','));
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

        // 作成日フィルター (厳密な境界値処理)
        if (filters.startDate) {
          query = query.gte('created_at', `${filters.startDate}T00:00:00.000Z`);
        }
        if (filters.endDate) {
          // 指定日の23:59:59.999まで (厳密な境界値)
          const nextDay = new Date(filters.endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayISO = nextDay.toISOString().split('T')[0];
          query = query.lt('created_at', `${nextDayISO}T00:00:00.000Z`);
        }

        // 発注担当者フィルター（暫定的に無効化）
        // if (filters.orderManagerId) {
        //   // 担当者フィルタリング機能は後で実装
        // }
      }

      // parent_order_idが設定されている取引のみを取得
      query = query.not('parent_order_id', 'is', null);

      const { data, error } = await query;

      if (error) {
        console.error('取引データ取得エラー:', error);
        throw new Error(`取引データの取得に失敗しました: ${error.message}`);
      }
      
      return data || [];
    },
  });
}