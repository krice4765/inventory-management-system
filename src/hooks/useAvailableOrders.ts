import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface AvailableOrder {
  purchase_order_id: string
  order_no: string
  remaining_amount: number
  total_amount: number
  partner_id: string
  order_date?: string
  status?: string
}

const fetchAvailableOrders = async (
  partnerId?: string,
  searchKeyword?: string
): Promise<AvailableOrder[]> => {
  if (!partnerId) return []
  
  try {
    // ステップ1: 発注データを取得
    let poQuery = supabase
      .from('purchase_orders')
      .select(`
        id,
        order_no,
        partner_id,
        total_amount,
        status,
        order_date,
        created_at
      `)
      .eq('partner_id', partnerId)
      .in('status', ['active'])

    if (searchKeyword && searchKeyword.trim()) {
      poQuery = poQuery.ilike('order_no', `%${searchKeyword.trim()}%`)
    }

    const { data: purchaseOrdersData, error: poError } = await poQuery
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (poError) {
      console.warn('useAvailableOrders: purchase_ordersクエリエラー', poError)
      return []
    }

    if (!purchaseOrdersData || purchaseOrdersData.length === 0) {
      return []
    }

    // ステップ2: 紐づく受領データを取得
    const purchaseOrderIds = purchaseOrdersData.map(po => po.id)
    const { data: receiptsData, error: receiptsError } = await supabase
      .from('transactions')
      .select(`parent_order_id, total_amount`)
      .in('parent_order_id', purchaseOrderIds)
      .eq('transaction_type', 'purchase')

    if (receiptsError) {
      console.warn('useAvailableOrders: 受領データ取得エラー', receiptsError)
      // エラー時のフォールバック
      return purchaseOrdersData.map(order => ({
        purchase_order_id: String(order.id),
        order_no: order.order_no || `PO-${order.id}`,
        remaining_amount: Number(order.total_amount || 0),
        total_amount: Number(order.total_amount || 0),
        partner_id: String(order.partner_id),
        order_date: order.order_date,
        status: order.status
      }))
    }

    // ステップ3: 正確な残額を計算
    const receivedAmountMap = (receiptsData || []).reduce((acc, receipt) => {
      if (receipt.parent_order_id) {
        acc[receipt.parent_order_id] = (acc[receipt.parent_order_id] || 0) + Number(receipt.total_amount || 0)
      }
      return acc
    }, {} as Record<string, number>)

    // ステップ4: 最終データを構築
    const finalAvailableOrders = purchaseOrdersData.map(order => {
      const id = String(order.id)
      const orderNo = order.order_no || `PO-${id}`
      const total = Number(order.total_amount || 0)
      const received = receivedAmountMap[id] || 0
      const remaining = Math.max(0, total - received) // 負の値を防止

      return {
        purchase_order_id: id,
        order_no: orderNo,
        remaining_amount: remaining,
        total_amount: total,
        partner_id: String(order.partner_id),
        order_date: order.order_date,
        status: order.status
      }
    })

    // 診断ログ
    console.log('仕入先ID:', partnerId)
    console.log('検索キーワード:', searchKeyword)
    console.log('取得件数:', finalAvailableOrders.length)
    console.log('残額計算サンプル:', finalAvailableOrders.slice(0, 2))
    console.log('============================')

    return finalAvailableOrders

  } catch (error) {
    console.error('useAvailableOrders: 予期しないエラー', error)
    return []
  }
}

export const useAvailableOrders = (
  partnerId?: string | null,
  searchKeyword?: string
) => {
  return useQuery<AvailableOrder[], Error>({
    queryKey: ['available-orders', { partnerId, searchKeyword }],
    queryFn: () => fetchAvailableOrders(partnerId || undefined, searchKeyword),
    enabled: !!partnerId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}