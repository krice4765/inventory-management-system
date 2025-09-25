import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// 発注明細のインターフェース（要件書に基づく拡張型）
interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price_tax_excluded: number;
  unit_price_tax_included: number;
  tax_rate: number;
  tax_category: 'standard_10' | 'reduced_8' | 'tax_free' | 'tax_exempt';
  subtotal_tax_excluded: number;
  subtotal_tax_included: number;
}

interface OrderDetail {
  id: string;
  order_no: string;
  partner_name: string;
  partner_code: string;
  delivery_deadline: string;
  assigned_user_name?: string;
  assigned_user_id?: string;
  items: OrderItem[];
  total_items_count: number;
  total_quantity: number;
  total_amount_tax_excluded: number;
  total_amount_tax_included: number;
  tax_8_amount: number;
  tax_10_amount: number;
  shipping_cost?: number;
  shipping_tax_rate?: number;
  created_at: string;
  status: string;
  delivery_progress: number;
}

// 発注詳細データを取得する関数
const getOrderDetail = async (orderId: string): Promise<OrderDetail> => {
  console.log('🔄 発注詳細データ取得開始:', { orderId });

  // メイン発注データを取得
  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      order_no,
      delivery_deadline,
      assigned_user_id,
      shipping_cost,
      shipping_tax_rate,
      created_at,
      status,
      partners!purchase_orders_partner_id_fkey (
        name,
        partner_code
      )
    `)
    .eq('id', orderId)
    .single();

  // assigned_userがある場合、別途user_profilesからデータを取得
  let assignedUserData = null;
  if (order && order.assigned_user_id) {
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('id', order.assigned_user_id)
      .single();
    assignedUserData = userData;
  }

  if (orderError) {
    console.error('❌ 発注データ取得エラー:', orderError);
    throw orderError;
  }

  if (!order) {
    throw new Error('発注データが見つかりません');
  }

  // 発注明細データを取得（purchase_order_itemsテーブルから）
  const { data: orderItems, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select(`
      id,
      product_id,
      quantity,
      unit_price,
      products!purchase_order_items_product_id_fkey (
        product_name,
        product_code,
        tax_category
      )
    `)
    .eq('purchase_order_id', orderId)
    .order('created_at');

  if (itemsError) {
    console.error('❌ 発注明細取得エラー:', itemsError);
    throw itemsError;
  }

  // 分納実績を取得して進捗を計算
  const { data: deliveries } = await supabase
    .from('transactions')
    .select('total_amount')
    .eq('parent_order_id', orderId)
    .eq('transaction_type', 'purchase')
    .eq('status', 'confirmed');

  const delivered_amount = deliveries?.reduce((sum, d) => sum + (d.total_amount || 0), 0) || 0;

  // 各明細アイテムに税計算を適用
  const processedItems: OrderItem[] = (orderItems || []).map(item => {
    const product = item.products;
    const tax_rate = product?.tax_category === 'reduced_8' ? 8 :
                    product?.tax_category === 'standard_10' ? 10 : 0;

    // 単価は現在のデータベースの値を使用（将来的に税抜/税込両方保存）
    const unit_price_tax_excluded = item.unit_price;
    const unit_price_tax_included = unit_price_tax_excluded * (1 + tax_rate / 100);

    const subtotal_tax_excluded = unit_price_tax_excluded * item.quantity;
    const subtotal_tax_included = unit_price_tax_included * item.quantity;

    return {
      id: item.id,
      product_id: item.product_id,
      product_name: product?.product_name || '商品名不明',
      product_code: product?.product_code || '',
      quantity: item.quantity,
      unit_price_tax_excluded,
      unit_price_tax_included,
      tax_rate,
      tax_category: product?.tax_category || 'standard_10',
      subtotal_tax_excluded,
      subtotal_tax_included,
    };
  });

  // 合計金額計算
  const total_amount_tax_excluded = processedItems.reduce((sum, item) => sum + item.subtotal_tax_excluded, 0);
  const total_amount_tax_included = processedItems.reduce((sum, item) => sum + item.subtotal_tax_included, 0);

  // 税率別金額計算
  const tax_8_amount = processedItems
    .filter(item => item.tax_rate === 8)
    .reduce((sum, item) => sum + (item.subtotal_tax_included - item.subtotal_tax_excluded), 0);

  const tax_10_amount = processedItems
    .filter(item => item.tax_rate === 10)
    .reduce((sum, item) => sum + (item.subtotal_tax_included - item.subtotal_tax_excluded), 0);

  // 数量合計
  const total_quantity = processedItems.reduce((sum, item) => sum + item.quantity, 0);

  // 進捗計算
  const delivery_progress = total_amount_tax_included > 0 ? (delivered_amount / total_amount_tax_included) * 100 : 0;

  // デバッグログを追加
  console.log('🔍 useOrderDetail データ確認:', {
    orderId,
    assigned_user_id: order.assigned_user_id,
    assigned_user: assignedUserData,
    order_no: order.order_no,
    shipping_cost: order.shipping_cost,
    shipping_tax_rate: order.shipping_tax_rate
  });

  const orderDetail: OrderDetail = {
    id: order.id,
    order_no: order.order_no,
    partner_name: order.partners?.name || '仕入先不明',
    partner_code: order.partners?.partner_code || '',
    delivery_deadline: order.delivery_deadline,
    assigned_user_name: assignedUserData?.full_name,
    assigned_user_id: order.assigned_user_id,
    items: processedItems,
    total_items_count: processedItems.length,
    total_quantity,
    total_amount_tax_excluded,
    total_amount_tax_included,
    tax_8_amount,
    tax_10_amount,
    shipping_cost: order.shipping_cost,
    shipping_tax_rate: order.shipping_tax_rate,
    created_at: order.created_at,
    status: order.status,
    delivery_progress,
  };

  console.log('✅ 発注詳細データ処理完了:', {
    orderId,
    itemsCount: processedItems.length,
    totalAmount: total_amount_tax_included,
    deliveryProgress: delivery_progress.toFixed(1) + '%'
  });

  return orderDetail;
};

// 発注詳細取得用カスタムフック
export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: () => {
      if (!orderId) {
        throw new Error('発注IDが指定されていません');
      }
      return getOrderDetail(orderId);
    },
    enabled: !!orderId, // orderIdがある場合のみクエリを実行
    staleTime: 60000, // 1分間キャッシュ
    refetchOnWindowFocus: false,
  });
}

// 商品名表示用のユーティリティ関数
export function getFirstProductName(orderDetail: OrderDetail | undefined): string {
  if (!orderDetail?.items?.length) {
    return '商品なし';
  }

  const firstProduct = orderDetail.items[0];
  const remainingCount = orderDetail.items.length - 1;

  if (remainingCount > 0) {
    return `${firstProduct.product_name} 他${remainingCount}件`;
  }

  return firstProduct.product_name;
}

// 数量合計表示用のユーティリティ関数
export function formatQuantitySummary(
  orderDetail: OrderDetail | undefined,
  taxDisplayMode: 'tax_included' | 'tax_excluded' = 'tax_included'
): string {
  if (!orderDetail) {
    return '- 個';
  }

  const totalQuantity = orderDetail.total_quantity;
  const totalAmount = taxDisplayMode === 'tax_included'
    ? orderDetail.total_amount_tax_included
    : orderDetail.total_amount_tax_excluded;

  // 税率混在チェック
  const taxRates = [...new Set(orderDetail.items.map(item => item.tax_rate))];
  const isMixedTax = taxRates.length > 1;

  if (isMixedTax) {
    return `${totalQuantity.toLocaleString()}個 ¥${totalAmount.toLocaleString()}（税込 混在）`;
  } else {
    const taxRate = taxRates[0] || 10;
    return `${totalQuantity.toLocaleString()}個 ¥${totalAmount.toLocaleString()}（${
      taxDisplayMode === 'tax_included' ? '税込' : '税抜'
    }${taxRate}%）`;
  }
}