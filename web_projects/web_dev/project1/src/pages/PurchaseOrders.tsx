import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, FileText, Check, X, Trash2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOrdersSync } from '../hooks/useOrdersSync';
import { useAvailableOrders } from '../hooks/useAvailableOrders';
import { useTransactionsWithParent } from '../hooks/useTransactionsWithParent';
import { ParentOrderCell } from '../components/ParentOrderCell';
import { TransactionWithParent } from '../types/purchase';
import { validateTransactionConfirm } from '../utils/validation';

// 型定義
interface PurchaseOrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  products: {
    id: string;
    name: string;
    product_code: string;
    purchase_price: number;
  };
}

interface Partner {
  id: string;
  name: string;
  partner_code: string;
}

interface Product {
  id: string;
  name: string;
  product_code: string;
  purchase_price: number;
}

// データ取得関数
const fetchPurchaseOrders = async (partnerId: string): Promise<TransactionWithParent[]> => {
  if (!partnerId) return [];
  const { data, error } = await supabase
    .from('v_transactions_with_parent')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as TransactionWithParent[];
};

export default function PurchaseOrders() {
  const queryClient = useQueryClient();
  const { syncOrderData } = useOrdersSync();

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('437fa348-d8e8-4ff1-9486-6fac17d20003');

  // ✅ 新規追加：検索機能のステート
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState('');

  // ✅ 検索キーワードのデバウンス処理（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchKeyword(searchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // ✅ 修正：useTransactionsWithParentに検索キーワードを渡す
  const { transactions, loading: transactionsLoading, error, refetch } =
    useTransactionsWithParent(selectedPartnerId, debouncedSearchKeyword);

  // 基本状態管理
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    transaction_no: '',
    transaction_date: new Date().toISOString().split('T')[0],
    due_date: '',
    partner_id: '',
    status: 'draft',
    memo: '',
    total_amount: 0,
    transaction_type: 'purchase',
    transaction_items: [] as PurchaseOrderItem[],
  });
  const [isNewRecord, setIsNewRecord] = useState(true);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [orderSearchKeyword, setOrderSearchKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // 新機能用ステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TransactionWithParent | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // デバウンス処理
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(orderSearchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [orderSearchKeyword]);

  // マスターデータ取得
  const { data: masterData, isLoading: isLoadingMasters } = useQuery({
    queryKey: ['master-data'],
    queryFn: fetchMasterData,
    staleTime: 0,
  });

  const { data: partners, isLoading: isLoadingPartners } = useQuery({
    queryKey: ['partners'],
    queryFn: fetchPartners,
    staleTime: 0,
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 0,
  });

  const { data: availableOrders, isLoading: isLoadingAvailableOrders } =
    useAvailableOrders(selectedPartnerId, debouncedKeyword);

  // ✅ 修正：overallLoadingで統合
  const overallLoading = transactionsLoading || isLoadingMasters || isLoadingPartners || isLoadingProducts;

  // データ取得関数群
  async function fetchMasterData(): Promise<{ partners: Partner[]; products: Product[] }> {
    const { data: partnersData, error: partnersError } = await supabase
      .from('partners')
      .select('*');
    if (partnersError) throw partnersError;

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*');
    if (productsError) throw productsError;

    console.log('=== フロントエンド マスターデータ診断 ===');
    console.log('取得したパートナー数:', partnersData.length);
    partnersData.forEach((p: Partner) =>
      console.log(`ID: ${p.id}, Name: ${p.name}, Code: ${p.partner_code}`)
    );
    console.log('=========================================');

    return { partners: partnersData, products: productsData };
  }

  async function fetchPartners(): Promise<Partner[]> {
    const { data, error } = await supabase.from('partners').select('*');
    if (error) throw error;
    return data;
  }

  async function fetchProducts(): Promise<Product[]> {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    return data;
  }

  // ミューテーション定義
  const createPurchaseOrderMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('新しい仕入伝票が作成されました');
      setShowForm(false);
      resetFormData();
      syncOrderData('仕入伝票を作成しました');
    },
    onError: (error) => {
      toast.error(`作成に失敗しました: ${error.message}`);
    },
  });

  const updatePurchaseOrderMutation = useMutation({
    mutationFn: updatePurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('仕入伝票が更新されました');
      setShowForm(false);
      syncOrderData('仕入伝票を更新しました');
    },
    onError: (error) => {
      toast.error(`更新に失敗しました: ${error.message}`);
    },
  });

  const deletePurchaseOrderMutation = useMutation({
    mutationFn: deletePurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('仕入伝票が削除されました');
      syncOrderData('仕入伝票を削除しました');
    },
    onError: (error) => {
      toast.error(`削除に失敗しました: ${error.message}`);
    },
  });

  // ヘルパー関数
  const resetFormData = () => {
    setFormData({
      transaction_no: '',
      transaction_date: new Date().toISOString().split('T')[0],
      due_date: '',
      partner_id: '',
      status: 'draft',
      memo: '',
      total_amount: 0,
      transaction_type: 'purchase',
      transaction_items: [],
    });
  };

  // CRUD操作関数
  async function createPurchaseOrder(newOrder: any) {
    const { transaction_items, ...orderData } = newOrder;

    console.log('=== データベース送信直前診断 ===');
    console.log('送信するpartner_id:', orderData.partner_id);
    console.log('送信するparent_order_id:', orderData.parent_order_id || null);
    console.log('総額:', orderData.total_amount);
    console.log('明細数:', transaction_items.length);
    console.log('===============================');

    const { data: order, error } = await supabase
      .from('transactions')
      .insert([orderData])
      .select()
      .single();

    if (error) throw error;

    if (transaction_items.length > 0) {
      const itemsWithOrderId = transaction_items.map((item: any) => ({
        ...item,
        transaction_id: order.id,
      }));
      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(itemsWithOrderId);
      if (itemsError) throw itemsError;
    }
  }

  async function updatePurchaseOrder(updatedOrder: any) {
    const { transaction_items, ...orderData } = updatedOrder;
    const { error } = await supabase
      .from('transactions')
      .update(orderData)
      .eq('id', orderData.id);
    if (error) throw error;

    await supabase.from('transaction_items').delete().eq('transaction_id', orderData.id);
    if (transaction_items.length > 0) {
      const itemsWithOrderId = transaction_items.map((item: any) => ({
        ...item,
        transaction_id: orderData.id,
      }));
      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(itemsWithOrderId);
      if (itemsError) throw itemsError;
    }
  }

  async function deletePurchaseOrder(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  }

  // イベントハンドラー
  const handlePartnerSelect = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    console.log('=== 仕入先選択診断 ===');
    console.log('選択されたpartner_id:', partnerId);
    console.log('partner_idの型:', typeof partnerId);
    console.log('partner_idの長さ:', partnerId.length);
    console.log('=====================');
  };

  // ✅ 修正：強化されたhandleConfirm関数
  const handleConfirm = async (transaction: TransactionWithParent) => {
    console.log('=== 取引確定処理開始 ===');
    console.log('Transaction ID:', transaction.id);
    console.log('Parent Order:', transaction.parent_order_code);
    console.log('Remaining:', transaction.parent_order_remaining);

    setIsConfirming(true);
    setConfirmError(null);

    // 事前バリデーション
    const validation = validateTransactionConfirm(transaction);

    if (!validation.canProceed) {
      console.error('バリデーションエラー:', validation.message);
      toast.error(validation.message);

      if (validation.suggestions) {
        validation.suggestions.forEach((suggestion) => {
          console.log('- ' + suggestion);
          toast.info(suggestion, { duration: 5000 });
        });
      }

      setIsConfirming(false);
      return;
    }

    if (validation.severity === 'info') {
      console.warn('情報:', validation.message);
      toast.info(validation.message);
    }

    try {
      console.log('=== データベース送信直前診断 ===');
      console.log('送信するpartner_id:', transaction.partner_id);
      console.log('送信するparent_order_id:', transaction.parent_order_id);
      console.log('総額:', transaction.transaction_total);
      console.log('===============================');

      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'confirmed' })
        .eq('id', transaction.id)
        .select()
        .single();

      if (error) {
        console.error('確定エラー詳細:', error);

        if (error.code === 'P0001') {
          setConfirmError(`発注額超過: ${error.message}`);
          toast.error(`発注額超過: ${error.message}`);
        } else {
          setConfirmError(`確定処理エラー: ${error.message}`);
          toast.error(`確定処理エラー: ${error.message}`);
        }
      } else {
        console.log('確定処理成功');
        toast.success('取引が確定されました');
        refetch();
      }
    } catch (error: any) {
      console.error('確定処理例外:', error);
      toast.error(error.message || '確定処理に失敗しました');
      setConfirmError(error.message || '確定処理に失敗しました');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async (transaction: TransactionWithParent) => {
    if (!window.confirm('この取引をキャンセルしますか？')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'draft' }) // データベーススキーマに応じて'cancelled'に変更可能
        .eq('id', transaction.id);

      if (error) throw error;
      toast.success('取引がキャンセルされました');
      refetch();
    } catch (error: any) {
      toast.error(`キャンセル失敗: ${error.message}`);
    }
  };

  const handleDelete = async (transaction: TransactionWithParent) => {
    if (!window.confirm('この取引を削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id);

      if (error) throw error;
      toast.success('取引が削除されました');
      refetch();
    } catch (error: any) {
      toast.error(`削除失敗: ${error.message}`);
    }
  };

  // ✅ 修正：overallLoadingを使用
  if (overallLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-3xl font-bold text-gray-800">仕入管理システム</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center shadow"
        >
          <Plus className="w-5 h-5 mr-2" />
          新規仕入伝票
        </button>
      </div>

      {/* フォーム表示部分は既存のまま維持 */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
          {/* 既存のフォームコンテンツ */}
        </div>
      )}

      {/* パートナー選択フィルタ */}
      <div className="bg-white p-4 rounded-lg shadow-md flex items-center space-x-4 flex-wrap">
        {/* 既存の仕入先フィルタ */}
        <div className="flex items-center space-x-2">
          <label htmlFor="partnerFilter" className="text-sm font-medium text-gray-700">
            仕入先フィルタ:
          </label>
          <select
            id="partnerFilter"
            value={selectedPartnerId}
            onChange={(e) => handlePartnerSelect(e.target.value)}
            className="block w-auto border border-gray-300 rounded-md shadow-sm p-2 text-sm"
          >
            <option value="">すべての仕入先</option>
            {partners?.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name} ({partner.partner_code})
              </option>
            ))}
          </select>
        </div>

        {/* ✅ 新規追加：検索入力欄 */}
        <div className="flex items-center space-x-2">
          <label htmlFor="searchFilter" className="text-sm font-medium text-gray-700">
            検索:
          </label>
          <div className="relative">
            <input
              id="searchFilter"
              type="text"
              placeholder="親発注番号、メモ、取引IDなど..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="block w-64 border border-gray-300 rounded-md shadow-sm p-2 pr-8 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="検索をクリア"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* 検索結果表示 */}
        {searchKeyword && (
          <div className="text-sm text-blue-600">
            "${searchKeyword}" の検索結果: {transactions?.length || 0}件
          </div>
        )}
      </div>

      {/* ✅ 修正：取引一覧テーブル */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">取引一覧</h2>
        </div>

        {overallLoading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            データの取得に失敗しました: ${error}
          </div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">取引データがありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    取引日付
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    親発注
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    金額
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.created_at).toLocaleDateString('ja-JP')}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <ParentOrderCell transaction={transaction} />
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      ¥{Number(transaction.transaction_total || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {transaction.status === 'confirmed' ? '確定' : '下書き'}
                      </span>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {transaction.status === 'draft' && (
                          <button
                            onClick={() => handleConfirm(transaction)}
                            disabled={isConfirming}
                            className={`text-green-600 hover:text-green-900 ${isConfirming ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isConfirming ? '処理中...' : '確定'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}