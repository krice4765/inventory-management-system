import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  AlertTriangle,
  Edit,
  Trash2,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { generatePurchaseOrderPDF } from '../lib/pdfGenerator';
import { useDeliveryModal } from '../stores/deliveryModal.store';
import { DeliveryModal } from '../components/DeliveryModal';

// 型定義
interface PurchaseOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  notes: string | null;
  product: {
    id: string;
    product_name: string;
    product_code: string;
    unit: string;
  };
}

interface PurchaseOrder {
  id: string;
  order_no: string;
  order_date: string;
  delivery_deadline: string | null;
  delivery_address: string | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  shipping_cost: number;
  shipping_tax_rate: number;
  supplier: {
    id: string;
    name: string;
    partner_code: string;
  } | null;
  created_by: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  items: PurchaseOrderItem[];
  delivery_status?: string;
  delivered_quantity?: number;
  total_quantity?: number;
}

// 納品ステータスのスタイル（日本語ステータスに対応）
const deliveryStatusStyles: Record<string, string> = {
  '未納品': 'bg-yellow-100 text-yellow-800',
  '一部納品': 'bg-blue-100 text-blue-800',
  '納品完了': 'bg-green-100 text-green-800',
  // 英語キーもサポート（後方互換性）
  undelivered: 'bg-yellow-100 text-yellow-800',
  partially_delivered: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
};

// データ取得関数
const fetchPurchaseOrderDetail = async (id: string): Promise<PurchaseOrder> => {
  // 発注情報を取得
  const { data: orderData, error: orderError } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (orderError) throw orderError;
  if (!orderData) throw new Error('発注データが見つかりません');

  // 仕入先情報を取得
  let supplierData = null;
  if (orderData.partner_id) {
    const { data, error: supplierError } = await supabase
      .from('partners')
      .select('id, name, partner_code')
      .eq('id', orderData.partner_id)
      .single();

    if (supplierError) throw supplierError;
    supplierData = data;
  }

  // 発注者情報を取得
  // まずuser_profilesを試す
  let createdByData = null;
  if (orderData.created_by_user_id) {
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('id', orderData.created_by_user_id)
      .maybeSingle();

    if (profileData) {
      createdByData = profileData;
    } else {
      // user_profilesにない場合はRPCファンクションでauth.usersから取得
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_user_info', { user_id: orderData.created_by_user_id });

      if (!rpcError && rpcData && rpcData.length > 0) {
        createdByData = {
          id: rpcData[0].id,
          full_name: rpcData[0].full_name,
          email: rpcData[0].email
        };
      }
    }
  }

  // 発注明細を取得
  const { data: itemsData, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select(`
      *,
      product:products (
        id,
        product_name,
        product_code,
        unit
      )
    `)
    .eq('purchase_order_id', id);

  if (itemsError) throw itemsError;

  // delivery_progressビューから納品状況を取得
  const { data: deliveryData } = await supabase
    .from('delivery_progress')
    .select('progress_status, delivered_quantity, ordered_quantity')
    .eq('purchase_order_id', id)
    .maybeSingle();

  return {
    ...orderData,
    supplier: supplierData,
    created_by: createdByData,
    items: itemsData || [],
    delivery_status: deliveryData?.progress_status || 'undelivered',
    delivered_quantity: deliveryData?.delivered_quantity || 0,
    total_quantity: deliveryData?.ordered_quantity || 0,
  } as PurchaseOrder;
};

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | null>(null);
  const openDeliveryModal = useDeliveryModal((state) => state.open);

  // 戻り先URLと状態を取得
  const savedState = location.state as any;
  const from = savedState?.fromPath || '/orders';

  // 発注詳細データ取得
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => fetchPurchaseOrderDetail(id!),
    enabled: !!id,
  });

  // 発注削除mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('発注を削除しました');
      navigate('/orders');
    },
    onError: (error: any) => {
      console.error('削除エラー:', error);
      toast.error(`削除に失敗しました: ${error.message}`);
    },
  });

  // PDF出力処理
  const handleGeneratePDF = async () => {
    if (!order) return;

    try {
      // 会社情報を取得
      const { data: companySettings, error: companyError } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();

      if (companyError) throw companyError;
      if (!companySettings) throw new Error('会社情報が見つかりません');

      // PDFデータを整形
      const pdfData = {
        order_no: order.order_no,
        order_date: order.order_date,
        delivery_deadline: order.delivery_deadline || undefined,
        partner: {
          name: order.supplier?.name || '不明な仕入先',
          address: undefined,
          phone: undefined,
          contact_person: undefined,
        },
        total_amount: order.total_amount,
        shipping_cost: order.shipping_cost || 0,
        shipping_tax_rate: order.shipping_tax_rate || 0,
        items: order.items.map((item) => ({
          product_name: item.product.product_name,
          product_code: item.product.product_code,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_amount,
        })),
        notes: order.notes || undefined,
        created_by: order.created_by?.full_name || order.created_by?.email || '担当者不明',
        company: {
          name: companySettings.company_name,
          address: `〒${companySettings.postal_code} ${companySettings.address}`,
          phone: `TEL: ${companySettings.phone}`,
          fax: companySettings.fax ? `FAX: ${companySettings.fax}` : undefined,
        },
      };

      await generatePurchaseOrderPDF(pdfData);
      toast.success('PDFをダウンロードしました');
    } catch (error) {
      console.error('PDF生成エラー:', error);
      toast.error('PDFの生成に失敗しました');
    }
  };

  // 削除確認
  const handleDelete = () => {
    setConfirmAction('delete');
    setIsConfirmDialogOpen(true);
  };

  // 削除実行
  const executeDelete = () => {
    deleteOrderMutation.mutate();
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
          発注が見つかりません
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <button
          onClick={() => navigate(from, { state: savedState })}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          戻る
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{order.order_no}</h1>
            <p className="text-sm text-gray-600 mt-1">発注詳細</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                deliveryStatusStyles[order.delivery_status || '未納品'] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {order.delivery_status || '未納品'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側: 発注情報 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本情報 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">発注番号</p>
                <p className="text-base font-medium text-gray-900">{order.order_no}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">発注日</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(order.order_date).toLocaleDateString('ja-JP')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">仕入先</p>
                <p className="text-base font-medium text-gray-900">
                  {order.supplier ? order.supplier.name : '未設定'}
                </p>
                {order.supplier && (
                  <p className="text-xs text-gray-500">{order.supplier.partner_code}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">納期</p>
                <p className="text-base font-medium text-gray-900">
                  {order.delivery_deadline
                    ? new Date(order.delivery_deadline).toLocaleDateString('ja-JP')
                    : '未指定'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">発注者</p>
                <p className="text-base font-medium text-gray-900">
                  {order.created_by ? order.created_by.full_name : '未設定'}
                </p>
                {order.created_by && (
                  <p className="text-xs text-gray-500">{order.created_by.email}</p>
                )}
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

          {/* 納品進捗 */}
          {order.delivery_status && (
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">納品進捗</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">納品状況:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      deliveryStatusStyles[order.delivery_status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {order.delivery_status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">納品数量:</span>
                  <span className="text-lg font-medium">
                    {order.delivered_quantity} / {order.total_quantity}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${
                        order.total_quantity
                          ? (order.delivered_quantity / order.total_quantity) * 100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* 発注明細 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">発注明細</h2>
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
                      小計
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {item.product.product_name}
                        </div>
                        <div className="text-xs text-gray-500">{item.product.product_code}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {item.quantity} {item.product.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        ¥{Number(item.unit_price).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        ¥{Number(item.total_amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 合計金額の内訳 */}
            <div className="mt-6 space-y-3">
              {/* 商品小計 */}
              <div className="flex justify-between items-center text-gray-700">
                <span>商品小計:</span>
                <span className="font-medium">
                  ¥{order.items.reduce((sum, item) => sum + Number(item.total_amount), 0).toLocaleString()}
                </span>
              </div>

              {/* 送料（税込） */}
              {order.shipping_cost > 0 && (
                <div className="flex justify-between items-center text-gray-700">
                  <span>
                    送料（税込{Math.round(order.shipping_tax_rate * 100)}%）:
                  </span>
                  <span className="font-medium">
                    ¥{Math.round(order.shipping_cost * (1 + order.shipping_tax_rate)).toLocaleString()}
                  </span>
                </div>
              )}

              {/* 区切り線 */}
              <div className="border-t border-gray-300 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">合計金額:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ¥{Number(order.total_amount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右側: アクション */}
        <div className="space-y-6">
          {/* 納品操作 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">納品操作</h2>
            <div className="space-y-3">
              {order.delivery_status !== 'delivered' && (
                <button
                  onClick={() => openDeliveryModal(id!)}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Package className="h-5 w-5" />
                  納品処理
                </button>
              )}

              {order.delivery_status === 'delivered' && (
                <div className="text-center text-gray-500 py-4">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  納品完了済み
                </div>
              )}
            </div>
          </div>

          {/* その他の操作 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">その他の操作</h2>
            <div className="space-y-3">
              {/* 編集は未納品または一部納品の場合のみ許可 */}
              {(order.delivery_status === 'undelivered' ||
                order.delivery_status === 'partially_delivered') && (
                <button
                  onClick={() => navigate(`/order/new?edit=${id}`)}
                  className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Edit className="h-5 w-5" />
                  編集
                </button>
              )}

              {/* PDFエクスポート */}
              <button
                onClick={handleGeneratePDF}
                className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <FileText className="h-5 w-5" />
                PDF出力
              </button>

              {/* 削除は未納品の場合のみ許可 */}
              {order.delivery_status === 'undelivered' && (
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

      {/* 削除確認ダイアログ */}
      {isConfirmDialogOpen && confirmAction === 'delete' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">発注削除の確認</h3>
            </div>
            <p className="text-gray-700 mb-6">
              この発注を削除してもよろしいですか？この操作は取り消せません。
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
                onClick={executeDelete}
                disabled={deleteOrderMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                {deleteOrderMutation.isPending ? '処理中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 納品モーダル */}
      <DeliveryModal />
    </div>
  );
}
