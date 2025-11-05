import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import toast from 'react-hot-toast'

export const useOrdersSync = () => {
  const queryClient = useQueryClient()
  // 関連する全クエリをinvalidate
  const syncOrderData = useCallback(async (message?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['delivery-progress'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['available-orders'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['delivery-order'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'], refetchType: 'active' }), // この行を追加
      // 受領・在庫関連のクエリを追加
      queryClient.invalidateQueries({ queryKey: ['receipts'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['stocks'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['inventory'], refetchType: 'active' }),
    ]);
    if (message) toast.success(message);
  }, [queryClient]);
  return { syncOrderData };
};
