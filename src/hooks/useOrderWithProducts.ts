import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface OrderProduct {
  id: string
  product_id: string
  product_name: string
  product_code: string
  quantity: number
  unit_price: number
  total_amount: number
}

interface OrderWithProducts {
  purchase_order_id: string
  order_no: string
  partner_name: string
  partner_id: string
  total_amount: number
  allocated_amount: number
  remaining_amount: number
  installment_count: number
  products: OrderProduct[]
}

export const useOrderWithProducts = (orderId: string | null) => {
  return useQuery<OrderWithProducts | null>({
    queryKey: ['order-with-products', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;

      // 発注情報取得
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('id, order_no, total_amount, partner_id')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // パートナー情報取得
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('id, name')
        .eq('id', orderData.partner_id)
        .single();

      if (partnerError) throw partnerError;

      // 商品情報取得
      const { data: productData, error: productError } = await supabase
        .from('purchase_order_items')
        .select(`
          id,
          product_id,
          quantity,
          unit_price,
          total_amount,
          products (
            product_name,
            product_code
          )
        `)
        .eq('purchase_order_id', orderId);

      if (productError) throw productError;

      // 既存分納情報取得（確定済みのみ）
      const { data: installments, error: installmentError } = await supabase
        .from('transactions')
        .select('total_amount, installment_no')
        .eq('parent_order_id', orderId)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed');

      if (installmentError) throw installmentError;

      const allocatedAmount = installments?.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0;
      const remainingAmount = Math.max(0, orderData.total_amount - allocatedAmount);
      const installmentCount = installments?.length || 0;

      // 商品情報を整形
      const products: OrderProduct[] = productData?.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: (item.products as any)?.product_name || '不明な商品',
        product_code: (item.products as any)?.product_code || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.total_amount
      })) || [];

        orderId,
        orderNo: orderData.order_no,
        productsCount: products.length,
        products,
        installmentCount,
        allocatedAmount,
        remainingAmount
      });

      return {
        purchase_order_id: String(orderData.id),
        order_no: orderData.order_no,
        partner_name: partnerData?.name || '不明',
        partner_id: String(orderData.partner_id),
        total_amount: orderData.total_amount,
        allocated_amount: allocatedAmount,
        remaining_amount: remainingAmount,
        installment_count: installmentCount,
        products
      };
    },
    staleTime: 30000, // 30秒間はキャッシュを使用
  })
}