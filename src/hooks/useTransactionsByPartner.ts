// src/hooks/useTransactionsByPartner.ts - PostgREST最適化版
import { useQuery } from '@tanstack/react-query';
import { supabase, db } from '../lib/supabase';
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
    queryKey: ['purchaseOrdersStable', partnerId, searchKeyword, filters],
    staleTime: 1000 * 60 * 5, // 5分間キャッシュ
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      // 🚨 強化されたフィルター対応検索パラメータ構築
      const searchParams: any = {};
      
      // 検索キーワードをパラメータに設定
      if (searchKeyword?.trim()) {
        searchParams.q = searchKeyword.trim();
      }
      
      // 🚨 強化されたフィルター条件（memo_actionの指示通り）
      if (filters) {
        // ステータスフィルター（下書き対応）
        if (filters.status === 'unconfirmed') {
          searchParams.status = 'draft'; // 下書き → draft
        } else if (filters.status === 'confirmed') {
          searchParams.status = 'confirmed';
        } else if (filters.status && filters.status !== 'all') {
          searchParams.status = filters.status;
        }
        
        // 日付フィルター
        if (filters.startDate) {
          searchParams.from = filters.startDate;
        }
        if (filters.endDate) {
          searchParams.to = filters.endDate;
        }
      }
      
      // 🚨 強化された安定化ビューAPIを使用
      const result = await db.stableViews.getPurchaseOrdersStable(searchParams);
      
      if (!result.success || !result.data) {
        console.error('Failed to fetch stable purchase orders:', result.error);
        throw new Error(result.error?.message || 'Failed to fetch purchase orders');
      }
      
      let stableData = result.data;
      
      // 仕入先フィルタリング（クライアントサイド）
      if (partnerId && partnerId !== 'all-partners') {
        stableData = stableData.filter(order => order.partner_id === partnerId);
      }
      
      // 🎯 金額フィルタリング（クライアントサイド）
      if (filters) {
        if (typeof filters.minAmount === 'number') {
          stableData = stableData.filter(order => (order.total_amount || 0) >= filters.minAmount);
        }
        if (typeof filters.maxAmount === 'number') {
          stableData = stableData.filter(order => (order.total_amount || 0) <= filters.maxAmount);
        }
      }
      
      // 既存のインターフェースに変換
      return stableData.map((order: any) => ({
        id: order.id,
        transaction_id: order.id,
        transaction_no: order.order_no,
        transaction_type: 'purchase',
        partner_id: order.partner_id,
        partner_name: order.partner_name,
        transaction_date: order.created_at,
        due_date: order.delivery_date,
        status: order.status,
        total_amount: order.total_amount,
        parent_order_id: order.id,
        memo: order.notes,
        order_memo: order.notes,
        transaction_memo: order.notes,
        product_name: order.item_summary,
        display_name: order.item_summary,
        item_summary: order.item_summary,
        item_count: order.item_count || 1,
        quantity: order.item_count,
        order_manager_name: order.manager_name || '—',
        order_manager_department: order.manager_department,
        installment_no: order.installment_no || 1,
        created_at: order.created_at,
        updated_at: order.updated_at
      }));
    },
  });
}