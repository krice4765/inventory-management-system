import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/inventory';
import type { InventoryMovement, MovementInsert } from '../api/inventory';

export function useInventoryMovements(limit = 50) {
  return useQuery<InventoryMovement[], Error>({
    queryKey: ['inventory-movements', limit],
    queryFn: () => api.getInventoryMovements(limit),
  });
}

export function useCreateInventoryMovement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.createInventoryMovement,
    onMutate: async (newMovement: MovementInsert) => {
      // 楽観的更新：履歴に即座に追加
      await queryClient.cancelQueries({ queryKey: ['inventory-movements'] });
      const previousMovements = queryClient.getQueryData<InventoryMovement[]>(['inventory-movements', 50]);
      
      const tempMovement: InventoryMovement = {
        id: Date.now(), // 一時的なID
        ...newMovement,
        created_at: new Date().toISOString(),
        user_id: null,
        products: undefined, // 後で正しい値に更新
      };
      
      queryClient.setQueryData<InventoryMovement[]>(['inventory-movements', 50], (old = []) => 
        [tempMovement, ...old]
      );
      
      // 商品データとダッシュボードも無効化（在庫更新反映のため）
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      return { previousMovements };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMovements) {
        queryClient.setQueryData(['inventory-movements', 50], context.previousMovements);
      }
    },
    onSettled: () => {
      // 成功・失敗に関わらず最新データを取得
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteInventoryMovement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.deleteInventoryMovement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}