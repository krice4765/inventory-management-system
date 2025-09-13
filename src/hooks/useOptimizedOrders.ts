import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface Partner {
  name: string;
  partner_code: string;
}

export interface PurchaseOrder {
  id: string;
  order_no: string;
  partner_id: string;
  total_amount: number;
  delivery_deadline: string;
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  partners: Partner;
  // 計算フィールド
  delivered_amount: number;
  remaining_amount: number;
  delivery_progress: number;
  is_overdue: boolean;
  delivery_count: number;
  latest_delivery_date?: string;
}

export interface OrderFilters {
  searchTerm?: string;
  status?: 'all' | 'draft' | 'confirmed' | 'completed' | 'cancelled';
  dateRange?: 'all' | 'today' | 'week' | 'month' | 'overdue';
  sortBy?: 'created_at' | 'delivery_deadline' | 'total_amount' | 'delivery_progress';
  sortOrder?: 'asc' | 'desc';
  partnerId?: string;
}

const PAGE_SIZE = 20;

// サーバー側での集計用のビュー作成（実際のプロダクションではDBビューを使用）
const getOrdersWithDeliveryProgress = async (
  page: number,
  filters: OrderFilters = {}
) => {
  console.log('🔄 発注データ取得開始:', { page, filters });

  // メインクエリ - JOINとサブクエリで一度に取得
  let query = supabase
    .from('purchase_orders')
    .select(`
      id,
      order_no,
      partner_id,
      total_amount,
      delivery_deadline,
      status,
      created_at,
      updated_at,
      partners!purchase_orders_partner_id_fkey (
        name,
        partner_code
      )
    `)
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  // フィルタ適用
  if (filters.searchTerm) {
    const searchTerm = filters.searchTerm.trim();
    console.log('🔍 検索条件:', { searchTerm, filters });
    if (searchTerm) {
      // シンプルな発注番号検索のみ（安全な実装）
      query = query.ilike('order_no', `%${searchTerm}%`);
      console.log('🔍 検索クエリ適用:', `order_no.ilike.%${searchTerm}%`);
    }
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.partnerId) {
    query = query.eq('partner_id', filters.partnerId);
  }

  // 日付フィルタ
  if (filters.dateRange) {
    const now = new Date();
    switch (filters.dateRange) {
      case 'today': {
        const today = now.toISOString().split('T')[0];
        query = query.gte('created_at', today);
        break;
      }
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', weekAgo.toISOString());
        break;
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', monthAgo.toISOString());
        break;
      }
      case 'overdue':
        query = query.lt('delivery_deadline', now.toISOString().split('T')[0]);
        break;
    }
  }

  // ソート
  const sortBy = filters.sortBy || 'created_at';
  query = query.order(sortBy, { ascending: filters.sortOrder === 'asc' });

  const { data: orders, error, count } = await query;

  if (error) {
    console.error('❌ 発注データ取得エラー:', error);
    throw error;
  }

  // データベースの実際の発注数をログ出力
  console.log('🔍 SQLクエリ結果詳細:', {
    取得件数: orders?.length || 0,
    totalCount: count,
    最新発注: orders?.slice(0, 2).map(o => ({ 
      id: o.id.substring(0, 8), 
      orderNo: o.order_no, 
      createdAt: o.created_at 
    })),
    timestamp: new Date().toLocaleTimeString()
  });

  if (!orders || orders.length === 0) {
    return {
      data: [],
      nextCursor: undefined,
      hasNextPage: false,
      total: count || 0
    };
  }

  // 分納実績を一括取得（N+1問題を解決）
  const orderIds = orders.map(o => o.id);
  const { data: deliveries, error: deliveryError } = await supabase
    .from('transactions')
    .select('parent_order_id, total_amount, delivery_sequence, created_at, transaction_date')
    .in('parent_order_id', orderIds)
    .eq('transaction_type', 'purchase')
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false });

  if (deliveryError) {
    console.warn('⚠️ 分納実績取得エラー:', deliveryError);
  }

  // 分納実績を発注IDごとにグループ化
  const deliveryMap = new Map();
  (deliveries || []).forEach(delivery => {
    const orderId = delivery.parent_order_id;
    if (!deliveryMap.has(orderId)) {
      deliveryMap.set(orderId, []);
    }
    deliveryMap.get(orderId).push(delivery);
  });

  // 発注データに分納実績を統合
  const ordersWithProgress: PurchaseOrder[] = orders.map(order => {
    const orderDeliveries = deliveryMap.get(order.id) || [];
    const delivered_amount = orderDeliveries.reduce((sum, d) => sum + (d.total_amount || 0), 0);
    const remaining_amount = order.total_amount - delivered_amount;
    const delivery_progress = order.total_amount > 0 ? (delivered_amount / order.total_amount) * 100 : 0;
    const is_overdue = new Date(order.delivery_deadline) < new Date() && delivery_progress < 100;
    const latest_delivery_date = orderDeliveries.length > 0 ? orderDeliveries[0].created_at : undefined;

    return {
      ...order,
      delivered_amount,
      remaining_amount,
      delivery_progress,
      is_overdue,
      delivery_count: orderDeliveries.length,
      latest_delivery_date,
    };
  });

  console.log('✅ 発注データ処理完了:', {
    page,
    orders: ordersWithProgress.length,
    hasDeliveries: deliveries?.length || 0,
  });

  return {
    data: ordersWithProgress,
    nextCursor: orders.length === PAGE_SIZE ? page + 1 : undefined,
    hasNextPage: orders.length === PAGE_SIZE,
    total: count || 0
  };
};

// 無限スクロール対応の発注データ取得
export function useInfiniteOrders(filters: OrderFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['orders', filters],
    queryFn: ({ pageParam = 0 }) => getOrdersWithDeliveryProgress(pageParam, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60000, // 1分間キャッシュ
    refetchOnWindowFocus: false,
    initialPageParam: 0,
  });
}

// 統計用全件発注データ取得（ダッシュボード専用）
export function useAllOrders(filters: OrderFilters = {}) {
  console.log('🔄 useAllOrders called with filters:', filters);
  
  return useQuery({
    queryKey: ['orders-all', JSON.stringify(filters)],
    queryFn: async () => {
      console.log('🔄 useAllOrders queryFn executing...');
      
      // ページ制限なしで全件取得するための特別な実装
      let query = supabase
        .from('purchase_orders')
        .select(`
          id,
          order_no,
          partner_id,
          total_amount,
          delivery_deadline,
          status,
          created_at,
          updated_at,
          partners!purchase_orders_partner_id_fkey (
            name,
            partner_code
          )
        `);

      // フィルタ適用
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.trim();
        if (searchTerm) {
          query = query.ilike('order_no', `%${searchTerm}%`);
        }
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.partnerId) {
        query = query.eq('partner_id', filters.partnerId);
      }

      // 日付フィルタ
      if (filters.dateRange) {
        const now = new Date();
        switch (filters.dateRange) {
          case 'today': {
            const today = now.toISOString().split('T')[0];
            query = query.gte('created_at', today);
            break;
          }
          case 'week': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            query = query.gte('created_at', weekAgo.toISOString());
            break;
          }
          case 'month': {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            query = query.gte('created_at', monthAgo.toISOString());
            break;
          }
          case 'overdue':
            query = query.lt('delivery_deadline', now.toISOString().split('T')[0]);
            break;
        }
      }

      // ソート（全件取得なので created_at でソート）
      const sortBy = filters.sortBy || 'created_at';
      query = query.order(sortBy, { ascending: filters.sortOrder === 'asc' });

      const { data: orders, error } = await query;

      if (error) {
        console.error('❌ 全発注データ取得エラー:', error);
        throw error;
      }

      console.log('🔍 全発注データ取得結果:', {
        取得件数: orders?.length || 0,
        timestamp: new Date().toLocaleTimeString()
      });

      // 分納実績を一括取得（必要に応じて）
      if (!orders || orders.length === 0) {
        return {
          data: [],
          total: 0
        };
      }

      const orderIds = orders.map(o => o.id);
      const { data: deliveries, error: deliveryError } = await supabase
        .from('transactions')
        .select('parent_order_id, total_amount, delivery_sequence, created_at, transaction_date')
        .in('parent_order_id', orderIds)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (deliveryError) {
        console.warn('⚠️ 分納実績取得エラー:', deliveryError);
      }

      // 分納実績を発注IDごとにグループ化
      const deliveryMap = new Map();
      (deliveries || []).forEach(delivery => {
        const orderId = delivery.parent_order_id;
        if (!deliveryMap.has(orderId)) {
          deliveryMap.set(orderId, []);
        }
        deliveryMap.get(orderId).push(delivery);
      });

      // 発注データに分納実績を統合
      const ordersWithProgress: PurchaseOrder[] = orders.map(order => {
        const orderDeliveries = deliveryMap.get(order.id) || [];
        const delivered_amount = orderDeliveries.reduce((sum, d) => sum + (d.total_amount || 0), 0);
        const remaining_amount = order.total_amount - delivered_amount;
        const delivery_progress = order.total_amount > 0 ? (delivered_amount / order.total_amount) * 100 : 0;
        const is_overdue = new Date(order.delivery_deadline) < new Date() && delivery_progress < 100;
        const latest_delivery_date = orderDeliveries.length > 0 ? orderDeliveries[0].created_at : undefined;

        return {
          ...order,
          delivered_amount,
          remaining_amount,
          delivery_progress,
          is_overdue,
          delivery_count: orderDeliveries.length,
          latest_delivery_date,
        };
      });

      console.log('✅ 全発注データ処理完了:', ordersWithProgress.length);

      return {
        data: ordersWithProgress,
        total: ordersWithProgress.length
      };
    },
    staleTime: 0, // キャッシュ無効化で確実な更新
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // 10秒ごとの自動再フェッチ
    refetchOnMount: 'always', // マウント時は必ず再フェッチ
  });
}

// ページネーション対応の発注データ取得（一覧表示用）
export function useOrders(filters: OrderFilters = {}) {
  console.log('🔄 useOrders called with filters:', filters);
  
  return useQuery({
    queryKey: ['orders-page', JSON.stringify(filters)], // JSON文字列化でキー統一
    queryFn: async () => {
      console.log('🔄 useOrders queryFn executing...');
      const result = await getOrdersWithDeliveryProgress(0, filters);
      console.log('✅ useOrders queryFn result:', { 
        count: result.data?.length || 0,
        timestamp: new Date().toLocaleTimeString()
      });
      return result;
    },
    staleTime: 0, // キャッシュ無効化で確実な更新
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // 10秒ごとの自動再フェッチ
    refetchOnMount: 'always', // マウント時は必ず再フェッチ
  });
}

// パートナー一覧取得（軽量）
export function usePartners() {
  return useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, partner_code')
        .order('name');
      
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // 5分間キャッシュ
    refetchOnWindowFocus: false,
  });
}

// 発注統計情報取得
export function useOrderStats(filters: OrderFilters = {}) {
  return useQuery({
    queryKey: ['order-stats', filters],
    queryFn: async () => {
      // 基本統計
      let statsQuery = supabase
        .from('purchase_orders')
        .select('status, total_amount, delivery_deadline', { count: 'exact' });

      // フィルタ適用
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.trim();
        if (searchTerm) {
          // シンプルな発注番号検索のみ（安全な実装）
          statsQuery = statsQuery.ilike('order_no', `%${searchTerm}%`);
        }
      }

      if (filters.status && filters.status !== 'all') {
        statsQuery = statsQuery.eq('status', filters.status);
      }

      if (filters.partnerId) {
        statsQuery = statsQuery.eq('partner_id', filters.partnerId);
      }

      const { data: orders, count, error } = await statsQuery;

      if (error) throw error;

      // 🔍 全ステータス値の分析用ログ
      const statusCounts = orders?.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      console.log('📊 発注ステータス分析:', {
        totalCount: count,
        dataLength: orders?.length || 0,
        statusBreakdown: statusCounts,
        latestOrders: orders?.slice(0, 3).map(o => ({ 
          id: o.id.substring(0, 8),
          status: o.status,
          created_at: o.created_at 
        }))
      });

      const now = new Date();
      const stats = {
        totalOrders: count || 0,
        totalAmount: orders?.reduce((sum, o) => sum + o.total_amount, 0) || 0,
        confirmedOrders: orders?.filter(o => o.status === 'confirmed').length || 0,
        completedOrders: orders?.filter(o => o.status === 'completed').length || 0,
        activeOrders: orders?.filter(o => o.status === 'active').length || 0, // active ステータスを追加
        overdueOrders: orders?.filter(o => 
          new Date(o.delivery_deadline) < now && o.status !== 'completed'
        ).length || 0,
        draftOrders: orders?.filter(o => o.status === 'draft').length || 0,
      };

      return stats;
    },
    staleTime: 300000, // 5分間キャッシュ
    refetchOnWindowFocus: false,
  });
}