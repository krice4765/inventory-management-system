import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface DeliveryHistoryItem {
  id: string
  total_amount: number
  delivery_sequence: number
  created_at: string
  transaction_date: string
  memo: string
}

interface DeliveryHistoryListProps {
  orderId: string | null
}

export const DeliveryHistoryList: React.FC<DeliveryHistoryListProps> = ({ orderId }) => {
  const { data: deliveryHistory, isLoading } = useQuery({
    queryKey: ['delivery-history', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return []
      
      const { data, error } = await supabase
        .from('transactions')
        .select('id, total_amount, delivery_sequence, created_at, transaction_date, memo')
        .eq('parent_order_id', orderId)
        .eq('transaction_type', 'purchase')
        .eq('status', 'confirmed')
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data as DeliveryHistoryItem[]
    },
    staleTime: 3000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        <span className="text-sm text-gray-600">履歴を読み込み中...</span>
      </div>
    )
  }

  if (!deliveryHistory || deliveryHistory.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        📝 分納履歴はまだありません
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-32 overflow-y-auto">
      {deliveryHistory.map((delivery, index) => (
        <div
          key={delivery.id}
          className="flex items-center justify-between p-3 bg-white rounded border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                第{index + 1}回
              </span>
              <div className="flex flex-col text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">📅 予定:</span>
                  <span className="text-blue-700 font-medium">
                    {new Date(delivery.transaction_date).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">✅ 実行:</span>
                  <span className="text-gray-600">
                    {new Date(delivery.created_at).toLocaleDateString('ja-JP')} {new Date(delivery.created_at).toLocaleTimeString('ja-JP', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>
            </div>
            {delivery.memo && (
              <div className="text-xs text-gray-500 mt-1">
                {delivery.memo.includes('理由:') ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-orange-600">📋</span>
                    <span className="truncate">{delivery.memo}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>💭</span>
                    <span className="truncate">{delivery.memo}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="font-semibold text-green-600">
              ¥{delivery.total_amount.toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}