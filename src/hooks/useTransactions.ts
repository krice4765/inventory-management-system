import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/transactions';
import type { Transaction, TransactionStatus } from '../api/transactions';
import toast from 'react-hot-toast';

export function usePurchaseOrders(limit = 50) {
  return useQuery<Transaction[], Error>({
    queryKey: ['purchase-orders', limit],
    queryFn: () => api.getPurchaseOrders(limit),
  });
}

export function usePurchaseOrder(id: number | null) {
  return useQuery<Transaction, Error>({
    queryKey: ['purchase-order', id],
    queryFn: () => id ? api.getPurchaseOrderById(id) : Promise.reject('No ID'),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createPurchaseOrder,
    onSuccess: (data) => {
      toast.success(`仕入伝票「${data.transaction_no}」を作成しました`);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    },
    onError: (error: Error) => {
      toast.error(`作成に失敗しました: ${error.message}`);
    },
  });
}

export function useUpdateTransactionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: TransactionStatus }) =>
      api.updateTransactionStatus(id, status),
    onSuccess: (data) => {
      const statusText = data.status === 'confirmed' ? '確定' : 
                        data.status === 'cancelled' ? 'キャンセル' : 
                        '下書きに戻';
      toast.success(`伝票を${statusText}しました`);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    },
    onError: (error: Error) => {
      toast.error(`ステータス更新に失敗しました: ${error.message}`);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: () => {
      toast.success('伝票を削除しました');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(`削除に失敗しました: ${error.message}`);
    },
  });
}

export function useAddInstallment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.addPurchaseInstallment,
    onSuccess: (data) => {
      toast.success(`第${data.installment_no}回分納を追加しました`);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['transactionsWithParent'] });
      queryClient.invalidateQueries({ queryKey: ['transactionsByPartner'] });
      queryClient.invalidateQueries({ queryKey: ['installment-order', data.parent_order_id] });
      queryClient.invalidateQueries({ queryKey: ['remainingAmount', data.parent_order_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error: Error & { code?: string }) => {
      if (error.code === 'P0001' || error.message?.includes('超過')) {
        toast.error('分納合計が発注金額を超過します');
      } else if (error.code === '23505') {
        toast.error('同時追加で分納番号が競合しました。もう一度お試しください。');
      } else {
        toast.error(`分納追加に失敗しました: ${error.message}`);
      }
    },
  });
}
