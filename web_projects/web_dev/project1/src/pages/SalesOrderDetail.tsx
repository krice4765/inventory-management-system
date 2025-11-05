import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  AlertTriangle,
  Edit,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

// 型定義
interface SalesOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  product: {
    id: string;
    name: string;
    product_code: string;
  };
}

interface SalesOrder {
  id: string;
  order_no: string;
  order_date: string;
  delivery_date: string | null;
  delivery_address: string | null;
  total_amount: number;
  tax_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    name: string;
    partner_code: string;
  };
  items: SalesOrderItem[];
}

// ステータスの日本語表示マッピング
const statusLabels: Record<SalesOrder['status'], string> = {
  pending: '受注確認待ち',
  confirmed: '受注確定',
  shipped: '出荷済み',
  completed: '完了',
  cancelled: 'キャンセル',
};

// ステータスのスタイル
const statusStyles: Record<SalesOrder['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

// データ取得関数
const fetchSalesOrderDetail = async (id: string): Promise<SalesOrder> => {
  const { data, error } = await supabase
    .from('sales_orders')
    .select(
      `
      *,
      customer:partners!customer_id (
        id,
        name,
        partner_code
      ),
      items:sales_order_items (
        *,
        product:products (
          id,
          name,
          product_code
        )
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as SalesOrder;
};

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    'confirm' | 'ship' | 'complete' | 'cancel' | null
  >(null);

  // 受注詳細データ取得
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => fetchSalesOrderDetail(id!),
    enabled: !!id,
  });

  // ステータス更新mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: SalesOrder['status']) => {
      const { error } = await supabase
        .from('sales_orders')
        .update({ status: newStatus })
        .eq('id', id!);

      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success(`ステータスを「${statusLabels[newStatus]}」に変更しました`);
      setIsConfirmDialogOpen(false);
      setConfirmAction(null);
    },
    onError: (error: any) => {
      console.error('ステータス更新エラー:', error);
      if (error.message?.includes('在庫不足')) {
        toast.error(`在庫不足のため受注確定できません: ${error.message}`);
      } else {
        toast.error(`ステータス変更に失敗しました: ${error.message}`);
      }
      setIsConfirmDialogOpen(false);
      setConfirmAction(null);
    },
  });

  // 受注削除mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sales_orders').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('受注を削除しました');
      navigate('/sales-orders');
    },
    onError: (error: any) => {
      console.error('削除エラー:', error);
      toast.error(`削除に失敗しました: ${error.message}`);
    },
  });

  // ステータス変更確認ダイアログを開く
  const handleStatusChange = (action: typeof confirmAction) => {
    setConfirmAction(action);
    setIsConfirmDialogOpen(true);
  };

  // ステータス変更実行
  const executeStatusChange = () => {
    if (!confirmAction) return;

    const statusMap: Record<typeof confirmAction, SalesOrder['status']> = {
      confirm: 'confirmed',
      ship: 'shipped',
      complete: 'completed',
      cancel: 'cancelled',
    };

    updateStatusMutation.mutate(statusMap[confirmAction]);
  };

  // 削除確認
  const handleDelete = () => {
    if (window.confirm('この受注を削除してもよろしいですか?')) {
      deleteOrderMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">
          エラーが発生しました: {error.message}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          受注が見つかりません
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/sales-orders')}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          受注一覧に戻る
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{order.order_no}</h1>
            <p className="text-sm text-gray-600 mt-1">受注詳細</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                statusStyles[order.status]
              }`}
            >
              {statusLabels[order.status]}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側: 受注情報 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本情報 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">受注番号</p>
                <p className="text-base font-medium text-gray-900">{order.order_no}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">受注日</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(order.order_date).toLocaleDateString('ja-JP')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">顧客</p>
                <p className="text-base font-medium text-gray-900">{order.customer.name}</p>
                <p className="text-xs text-gray-500">{order.customer.partner_code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">納期</p>
                <p className="text-base font-medium text-gray-900">
                  {order.delivery_date
                    ? new Date(order.delivery_date).toLocaleDateString('ja-JP')
                    : '未指定'}
                </p>
              </div>
              {order.delivery_address && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">納品先住所</p>
                  <p className="text-base font-medium text-gray-900 whitespace-pre-wrap">
                    {order.delivery_address}
                  </p>
                </div>
              )}
              {order.notes && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">備考</p>
                  <p className="text-base font-medium text-gray-900 whitespace-pre-wrap">
                    {order.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 受注明細 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">受注明細</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      商品
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      数量
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      単価
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      税率
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      小計
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      税額
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      合計
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {item.product.name}
                        </div>
                        <div className="text-xs text-gray-500">{item.product.product_code}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        ¥{Number(item.unit_price).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {item.tax_rate}%
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        ¥{Number(item.subtotal).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        ¥{Number(item.tax_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        ¥{Number(item.total_amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 合計金額 */}
            <div className="mt-6 bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">小計:</span>
                <span className="text-lg font-medium">
                  ¥{(Number(order.total_amount) - Number(order.tax_amount)).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">消費税:</span>
                <span className="text-lg font-medium">
                  ¥{Number(order.tax_amount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2 border-blue-200">
                <span className="text-lg font-bold text-gray-900">合計金額（税込）:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ¥{Number(order.total_amount).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 右側: アクション */}
        <div className="space-y-6">
          {/* ステータス変更 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">ステータス変更</h2>
            <div className="space-y-3">
              {order.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleStatusChange('confirm')}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    受注確定
                  </button>
                  <button
                    onClick={() => handleStatusChange('cancel')}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <XCircle className="h-5 w-5" />
                    キャンセル
                  </button>
                </>
              )}

              {order.status === 'confirmed' && (
                <>
                  <button
                    onClick={() => handleStatusChange('ship')}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                  >
                    <Truck className="h-5 w-5" />
                    出荷済みにする
                  </button>
                  <button
                    onClick={() => handleStatusChange('cancel')}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <XCircle className="h-5 w-5" />
                    キャンセル
                  </button>
                </>
              )}

              {order.status === 'shipped' && (
                <button
                  onClick={() => handleStatusChange('complete')}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Package className="h-5 w-5" />
                  完了にする
                </button>
              )}

              {(order.status === 'completed' || order.status === 'cancelled') && (
                <div className="text-center text-gray-500 py-4">
                  ステータス変更はできません
                </div>
              )}
            </div>
          </div>

          {/* その他の操作 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">その他の操作</h2>
            <div className="space-y-3">
              {/* 編集は pending 状態のみ許可 */}
              {order.status === 'pending' && (
                <button
                  onClick={() => navigate(`/sales-orders/${id}/edit`)}
                  className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Edit className="h-5 w-5" />
                  編集
                </button>
              )}

              {/* 削除は pending と cancelled のみ許可 */}
              {(order.status === 'pending' || order.status === 'cancelled') && (
                <button
                  onClick={handleDelete}
                  className="w-full border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-5 w-5" />
                  削除
                </button>
              )}
            </div>
          </div>

          {/* メタ情報 */}
          <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
            <p className="mb-1">
              作成日時: {new Date(order.created_at).toLocaleString('ja-JP')}
            </p>
            <p>更新日時: {new Date(order.updated_at).toLocaleString('ja-JP')}</p>
          </div>
        </div>
      </div>

      {/* 確認ダイアログ */}
      {isConfirmDialogOpen && confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <h3 className="text-lg font-semibold text-gray-900">ステータス変更の確認</h3>
            </div>
            <p className="text-gray-700 mb-6">
              {confirmAction === 'confirm' &&
                '受注を確定します。在庫が引き当てられますがよろしいですか?'}
              {confirmAction === 'ship' &&
                '出荷済みにします。在庫が減少しますがよろしいですか?'}
              {confirmAction === 'complete' && '受注を完了にしますがよろしいですか?'}
              {confirmAction === 'cancel' &&
                '受注をキャンセルします。引当済みの在庫は解放されますがよろしいですか?'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsConfirmDialogOpen(false);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={executeStatusChange}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {updateStatusMutation.isPending ? '処理中...' : '確定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
