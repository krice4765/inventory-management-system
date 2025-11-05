// hooks/useTransactionsWithParent.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TransactionWithParent } from '../types/purchase';

export const useTransactionsWithParent = (
  partnerId: string | null,
  searchKeyword: string = ''  // ✅ 検索キーワード引数を追加
) => {
  const [transactions, setTransactions] = useState<TransactionWithParent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    console.log('=== 親発注情報付き取引データ取得開始 ===');
    console.log('Partner ID:', partnerId);
    console.log('Search Keyword:', searchKeyword); // ✅ 検索キーワードのログ

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('v_transactions_with_parent')
        .select('*')
        .order('created_at', { ascending: false });

      // partner_idが指定されている場合のみフィルタリング
      if (partnerId && partnerId !== '') {
        query = query.eq('partner_id', partnerId);
      }

      // ✅ 検索キーワードによるフィルタリング
      if (searchKeyword && searchKeyword.trim()) {
        const keyword = searchKeyword.trim();
        query = query.or(
          `parent_order_code.ilike.%${keyword}%,notes.ilike.%${keyword}%,transaction_no.ilike.%${keyword}%`
        );
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('ビュー取得エラー:', fetchError);
        throw fetchError;
      }

      console.log('=== 親発注情報取得成功 ===');
      console.log('取得データ数:', data?.length || 0);

      if (searchKeyword) {
        console.log('検索結果:', `"${searchKeyword}" で ${data?.length || 0}件ヒット`);
      }

      // 親発注別の統計をログ出力
      const stats = data?.reduce((acc, tx) => {
        const code = tx.parent_order_code || 'UNASSIGNED';
        if (!acc[code]) {
          acc[code] = {
            count: 0,
            remaining: tx.parent_order_remaining,
            status: tx.parent_order_status
          };
        }
        acc[code].count++;
        return acc;
      }, {} as Record<string, any>);

      console.log('親発注別統計:', stats);
      console.log('==============================');

      setTransactions(data || []);

    } catch (err: any) {
      console.error('親発注情報取得失敗:', err);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [partnerId, searchKeyword]); // ✅ searchKeywordを依存配列に追加

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { transactions, loading, error, refetch: fetchData };
};