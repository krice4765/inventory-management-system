import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// 出庫管理の型定義（OutboundOrders.tsxと統一）
export interface OutboundOrder {
  id: string;
  order_number: string;
  customer_name: string;
  request_date: string;
  due_date?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes?: string;
  total_amount: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: OutboundOrderItem[];
}

export interface OutboundOrderItem {
  id: string;
  outbound_order_id: string;
  product_id: string;
  quantity_requested: number;
  quantity_shipped: number;
  unit_price_tax_excluded: number;
  unit_price_tax_included: number;
  tax_rate: number;
  created_at: string;
  product?: {
    id: string;
    product_name: string;
    product_code: string;
    current_stock: number;
    tax_category: string;
  };
}

// 出庫指示作成リクエストの型
export interface CreateOutboundRequest {
  customer_name: string;
  request_date: string;
  due_date?: string;
  notes?: string;
  items: {
    product_id: string;
    quantity_requested: number;
    unit_price_tax_excluded?: number;
  }[];
}

// 在庫引当チェック結果
export interface StockAllocationResult {
  product_id: string;
  product_name: string;
  requested_quantity: number;
  available_quantity: number;
  can_fulfill: boolean;
  shortage: number;
}

// 出庫実績登録リクエスト
export interface ShipmentRequest {
  outbound_order_id: string;
  items: {
    item_id: string;
    quantity_shipped: number;
  }[];
}

// フィルタの型
export interface OutboundFilters {
  status?: 'pending' | 'processing' | 'completed' | 'cancelled' | 'all';
  customer_name?: string;
  start_date?: string;
  end_date?: string;
  search_term?: string;
}

// 出庫指示一覧取得
const getOutboundOrders = async (filters?: OutboundFilters): Promise<OutboundOrder[]> => {

  let query = supabase
    .from('outbound_orders')
    .select(`
      *,
      items:outbound_order_items(
        *,
        product:products(
          id,
          product_name,
          product_code,
          current_stock,
          tax_category
        )
      )
    `)
    .order('created_at', { ascending: false });

  // フィルタ適用
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.customer_name) {
    query = query.ilike('customer_name', `%${filters.customer_name}%`);
  }

  if (filters?.start_date) {
    query = query.gte('request_date', filters.start_date);
  }

  if (filters?.end_date) {
    query = query.lte('request_date', filters.end_date);
  }

  if (filters?.search_term) {
    query = query.or(`order_number.ilike.%${filters.search_term}%,customer_name.ilike.%${filters.search_term}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Failed to fetch outbound orders:', error);
    throw error;
  }

  // データ変換（current_stockの配列を数値に変換）
  const transformedData = (data || []).map(order => ({
    ...order,
    items: order.items?.map(item => ({
      ...item,
      product: item.product ? {
        ...item.product,
        current_stock: item.product.current_stock?.[0]?.current_stock || 0
      } : undefined
    }))
  }));

  return transformedData as OutboundOrder[];
};

// 特定の出庫指示詳細取得
const getOutboundOrderDetail = async (orderId: string): Promise<OutboundOrder | null> => {

  const { data, error } = await supabase
    .from('outbound_orders')
    .select(`
      *,
      items:outbound_order_items(
        *,
        product:products(
          id,
          product_name,
          product_code,
          current_stock:inventory(current_stock),
          tax_category
        )
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn('⚠️ Outbound order not found:', orderId);
      return null;
    }
    console.error('❌ Failed to fetch outbound order detail:', error);
    throw error;
  }

  // データ変換
  const transformedData = {
    ...data,
    items: data.items?.map(item => ({
      ...item,
      product: item.product ? {
        ...item.product,
        current_stock: item.product.current_stock?.[0]?.current_stock || 0
      } : undefined
    }))
  };

  return transformedData as OutboundOrder;
};

// 在庫引当チェック
const checkStockAllocation = async (items: CreateOutboundRequest['items']): Promise<StockAllocationResult[]> => {

  const productIds = items.map(item => item.product_id);

  // 現在の在庫情報を取得
  const { data: inventoryData, error } = await supabase
    .from('inventory')
    .select(`
      product_id,
      current_stock,
      reserved_quantity,
      product:products(product_name)
    `)
    .in('product_id', productIds);

  if (error) {
    console.error('❌ Failed to fetch inventory data:', error);
    throw error;
  }

  // 引当結果を計算
  const results: StockAllocationResult[] = items.map(item => {
    const inventory = inventoryData?.find(inv => inv.product_id === item.product_id);
    const available_quantity = inventory
      ? (inventory.current_stock - (inventory.reserved_quantity || 0))
      : 0;
    const can_fulfill = available_quantity >= item.quantity_requested;
    const shortage = can_fulfill ? 0 : item.quantity_requested - available_quantity;

    return {
      product_id: item.product_id,
      product_name: inventory?.product?.product_name || '不明な商品',
      requested_quantity: item.quantity_requested,
      available_quantity,
      can_fulfill,
      shortage
    };
  });

  const fulfillableCount = results.filter(r => r.can_fulfill).length;

  return results;
};

// 出庫指示作成
const createOutboundOrder = async (request: CreateOutboundRequest): Promise<OutboundOrder> => {

  // 1. 在庫引当チェック
  const allocationResults = await checkStockAllocation(request.items);
  const unfulfilledItems = allocationResults.filter(r => !r.can_fulfill);

  if (unfulfilledItems.length > 0) {
    const errorMessage = `在庫不足: ${unfulfilledItems.map(item =>
      `${item.product_name}(不足${item.shortage}個)`
    ).join(', ')}`;
    throw new Error(errorMessage);
  }

  // 2. 出庫番号生成（OUT-YYYY-NNN形式）
  const today = new Date();
  const year = today.getFullYear();
  const prefix = `OUT-${year}-`;

  const { data: lastOrder } = await supabase
    .from('outbound_orders')
    .select('order_number')
    .like('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1);

  let orderNumber: string;
  if (lastOrder && lastOrder.length > 0) {
    const lastNumber = parseInt(lastOrder[0].order_number.split('-')[2]);
    orderNumber = `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
  } else {
    orderNumber = `${prefix}001`;
  }

  // 3. トランザクション開始
  const { data: currentUser } = await supabase.auth.getUser();

  // 3.1 出庫指示ヘッダー作成
  const { data: orderData, error: orderError } = await supabase
    .from('outbound_orders')
    .insert({
      order_number: orderNumber,
      customer_name: request.customer_name,
      request_date: request.request_date,
      due_date: request.due_date,
      notes: request.notes,
      status: 'pending',
      total_amount: 0, // 後で計算
      created_by: currentUser?.user?.id
    })
    .select()
    .single();

  if (orderError) {
    console.error('❌ Failed to create outbound order:', orderError);
    throw orderError;
  }

  // 3.2 出庫明細作成
  let totalAmount = 0;
  const orderItems = [];

  for (const item of request.items) {
    // 商品情報取得（税区分・価格情報）
    const { data: productData } = await supabase
      .from('products')
      .select('tax_category, selling_price')
      .eq('id', item.product_id)
      .single();

    const taxRate = productData?.tax_category === 'reduced_8' ? 0.08 : 0.10;
    const unitPriceTaxExcluded = item.unit_price_tax_excluded || productData?.selling_price || 0;
    const unitPriceTaxIncluded = Math.floor(unitPriceTaxExcluded * (1 + taxRate));

    const { data: itemData, error: itemError } = await supabase
      .from('outbound_order_items')
      .insert({
        outbound_order_id: orderData.id,
        product_id: item.product_id,
        quantity_requested: item.quantity_requested,
        quantity_shipped: 0,
        unit_price_tax_excluded: unitPriceTaxExcluded,
        unit_price_tax_included: unitPriceTaxIncluded,
        tax_rate: taxRate
      })
      .select()
      .single();

    if (itemError) {
      console.error('❌ Failed to create outbound order item:', itemError);
      throw itemError;
    }

    orderItems.push(itemData);
    totalAmount += unitPriceTaxIncluded * item.quantity_requested;
  }

  // 3.3 合計金額更新
  await supabase
    .from('outbound_orders')
    .update({ total_amount: totalAmount })
    .eq('id', orderData.id);

  // 4. 在庫引当（reserved_quantity更新）
  for (const item of request.items) {
    await supabase.rpc('update_inventory_with_lock', {
      target_product_id: item.product_id,
      quantity_change: 0, // 実際の減算は出庫実績時
      unit_price: null,
      tax_rate: null
    });

    // 引当数量を増加
    await supabase
      .from('inventory')
      .update({
        reserved_quantity: supabase.raw('COALESCE(reserved_quantity, 0) + ?', [item.quantity_requested])
      })
      .eq('product_id', item.product_id);
  }

  const result = {
    ...orderData,
    items: orderItems
  } as OutboundOrder;

  return result;
};

// 出庫実績登録
const registerShipment = async (request: ShipmentRequest): Promise<void> => {

  for (const item of request.items) {
    if (item.quantity_shipped <= 0) continue;

    // 明細情報取得
    const { data: itemData, error: fetchError } = await supabase
      .from('outbound_order_items')
      .select('*, product:products(id)')
      .eq('id', item.item_id)
      .single();

    if (fetchError || !itemData) {
      throw new Error(`明細が見つかりません: ${item.item_id}`);
    }

    // 出庫数量更新
    const { error: updateError } = await supabase
      .from('outbound_order_items')
      .update({
        quantity_shipped: supabase.raw('quantity_shipped + ?', [item.quantity_shipped])
      })
      .eq('id', item.item_id);

    if (updateError) {
      throw updateError;
    }

    // 実在庫減算（FIFO方式）
    await supabase.rpc('update_inventory_with_lock', {
      target_product_id: itemData.product_id,
      quantity_change: -item.quantity_shipped,
      unit_price: null,
      tax_rate: null
    });

    // 引当数量減算
    await supabase
      .from('inventory')
      .update({
        reserved_quantity: supabase.raw('GREATEST(COALESCE(reserved_quantity, 0) - ?, 0)', [item.quantity_shipped])
      })
      .eq('product_id', itemData.product_id);
  }

  // 出庫指示のステータス更新判定
  const { data: orderItems } = await supabase
    .from('outbound_order_items')
    .select('quantity_requested, quantity_shipped')
    .eq('outbound_order_id', request.outbound_order_id);

  if (orderItems) {
    const totalRequested = orderItems.reduce((sum, item) => sum + item.quantity_requested, 0);
    const totalShipped = orderItems.reduce((sum, item) => sum + item.quantity_shipped, 0);

    let newStatus: OutboundOrder['status'] = 'pending';
    if (totalShipped >= totalRequested) {
      newStatus = 'completed';
    } else if (totalShipped > 0) {
      newStatus = 'processing';
    }

    await supabase
      .from('outbound_orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', request.outbound_order_id);
  }

};

// 出庫管理カスタムフック
export function useOutboundManagement() {
  const queryClient = useQueryClient();

  // 出庫指示一覧取得
  const useOutboundOrders = (filters?: OutboundFilters) => {
    return useQuery({
      queryKey: ['outbound-orders', filters],
      queryFn: () => getOutboundOrders(filters),
      staleTime: 300000, // 5分間キャッシュ
      refetchOnWindowFocus: false,
    });
  };

  // 出庫指示詳細取得
  const useOutboundOrderDetail = (orderId: string | null) => {
    return useQuery({
      queryKey: ['outbound-order-detail', orderId],
      queryFn: () => orderId ? getOutboundOrderDetail(orderId) : Promise.resolve(null),
      enabled: !!orderId,
      staleTime: 300000,
      refetchOnWindowFocus: false,
    });
  };

  // 在庫引当チェック
  const useStockAllocationCheck = () => {
    return useMutation({
      mutationFn: checkStockAllocation,
      onSuccess: (results) => {
        const unfulfilledCount = results.filter(r => !r.can_fulfill).length;
        if (unfulfilledCount > 0) {
          toast.error(`${unfulfilledCount}件の商品で在庫不足があります`);
        } else {
          toast.success('全ての商品で在庫引当が可能です');
        }
      },
      onError: (error) => {
        console.error('Stock allocation check error:', error);
        toast.error('在庫引当チェックに失敗しました');
      },
    });
  };

  // 出庫指示作成
  const useCreateOutboundOrder = () => {
    return useMutation({
      mutationFn: createOutboundOrder,
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['outbound-orders'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.success(`出庫指示を作成しました: ${data.order_number}`);
      },
      onError: (error: Error) => {
        console.error('Create outbound order error:', error);
        toast.error(error.message || '出庫指示の作成に失敗しました');
      },
    });
  };

  // 出庫実績登録
  const useRegisterShipment = () => {
    return useMutation({
      mutationFn: registerShipment,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['outbound-orders'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.success('出庫実績を登録しました');
      },
      onError: (error: Error) => {
        console.error('Register shipment error:', error);
        toast.error(error.message || '出庫実績の登録に失敗しました');
      },
    });
  };

  return {
    // クエリフック
    useOutboundOrders,
    useOutboundOrderDetail,

    // ミューテーションフック
    useStockAllocationCheck,
    useCreateOutboundOrder,
    useRegisterShipment,

    // ユーティリティ
    checkStockAllocation,
  };
}

// 出庫管理ユーティリティ
export const OutboundUtils = {
  // ステータス表示ラベル
  getStatusLabel: (status: OutboundOrder['status']): string => {
    const labels = {
      pending: '未処理',
      processing: '処理中',
      completed: '完了',
      cancelled: 'キャンセル',
    };
    return labels[status] || status;
  },

  // 進捗率計算
  getProgressRate: (order: OutboundOrder): number => {
    if (!order.items || order.items.length === 0) return 0;

    const totalRequested = order.items.reduce((sum, item) => sum + item.quantity_requested, 0);
    const totalShipped = order.items.reduce((sum, item) => sum + item.quantity_shipped, 0);

    return totalRequested > 0 ? Math.round((totalShipped / totalRequested) * 100) : 0;
  },

  // 納期緊急度判定
  isUrgent: (dueDate?: string): boolean => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  },

  // 在庫充足チェック
  checkStockSufficiency: (items: OutboundOrderItem[]): boolean => {
    return items.every(item =>
      item.product && item.product.current_stock >= item.quantity_requested
    );
  },
};