import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { usePageState } from '../hooks/usePageState';
import { supabase } from '../lib/supabase';
import { Plus, FileText, Check, X, Trash2, Calendar, TrendingUp, Package, AlertCircle, Filter, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import { useOrdersSync } from '../hooks/useOrdersSync';
import { useAvailableOrders } from '../hooks/useAvailableOrders';
import { useTransactionsWithParent } from '../hooks/useTransactionsWithParent';
import { ParentOrderCell } from '../components/ParentOrderCell';
import { TransactionWithParent } from '../types/purchase';
import { validateTransactionConfirm } from '../utils/validation';
import { purchaseOrderFormSchema, PurchaseOrderFormData } from '../lib/validations';
import { FormField, FormInput, FormTextarea } from '../components/FormField';
import { getTaxRate } from '../lib/taxRates';
import { useAuthStore } from '../stores/authStore';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';

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
  tax_category: 'standard_10' | 'reduced_8';
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
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { savePageState, restorePageState } = usePageState();

  // URLパラメータから検索キーワードを取得
  const searchParams = new URLSearchParams(location.search);
  const initialSearch = searchParams.get('search') || '';

  // フィルター状態管理
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState(initialSearch);
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState(initialSearch);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // 検索キーワードのデバウンス処理（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchKeyword(searchKeyword);
      // URLパラメータを更新
      const params = new URLSearchParams(location.search);
      if (searchKeyword) {
        params.set('search', searchKeyword);
      } else {
        params.delete('search');
      }
      navigate(`?${params.toString()}`, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword, navigate, location.search]);

  // ページ状態の復元
  useEffect(() => {
    const restored = restorePageState();
    if (restored && restored.filters) {
      const filters = restored.filters;
      if (filters.selectedPartnerId) setSelectedPartnerId(filters.selectedPartnerId);
      if (filters.statusFilter) setStatusFilter(filters.statusFilter);
      if (filters.searchKeyword) setSearchKeyword(filters.searchKeyword);
      if (filters.dateFrom) setDateFrom(filters.dateFrom);
      if (filters.dateTo) setDateTo(filters.dateTo);
      if (filters.showFilters !== undefined) setShowFilters(filters.showFilters);
    }
  }, []);

  // ✅ 修正：useTransactionsWithParentに検索キーワードを渡す
  const { transactions, loading: transactionsLoading, error, refetch } =
    useTransactionsWithParent(selectedPartnerId, debouncedSearchKeyword);

  // 基本状態管理
  const [showForm, setShowForm] = useState(false);

  // React Hook Form setup for purchase order
  const {
    register,
    control,
    handleSubmit: handlePurchaseSubmit,
    formState: { errors: purchaseErrors, isSubmitting: isPurchaseSubmitting },
    setValue: setPurchaseValue,
    watch: watchPurchase,
    reset: resetPurchaseForm,
  } = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      supplier_id: selectedPartnerId || '',
      invoice_no: '',
      transaction_date: new Date().toISOString().split('T')[0],
      payment_due_date: '',
      notes: '',
      items: [
        {
          product_id: '',
          quantity: 1,
          unit_price: 0,
          tax_rate: 10,
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

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
    const { data, error} = await supabase.from('products').select('*');
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

  // フォーム送信ハンドラー (React Hook Form)
  const onSubmitPurchaseOrder = async (formData: PurchaseOrderFormData) => {
    try {
      // Calculate totals from items
      const itemsWithCalculatedTotals = formData.items.map(item => {
        const subtotal = item.quantity * item.unit_price;
        const tax = subtotal * (item.tax_rate / 100);
        return {
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          subtotal,
          tax_amount: tax,
          total_amount: subtotal + tax,
        };
      });

      const grandSubtotal = itemsWithCalculatedTotals.reduce((sum, item) => sum + item.subtotal, 0);
      const grandTax = itemsWithCalculatedTotals.reduce((sum, item) => sum + item.tax_amount, 0);
      const grandTotal = grandSubtotal + grandTax;

      // Prepare transaction data
      const transactionData = {
        partner_id: formData.supplier_id,
        transaction_no: formData.invoice_no,
        transaction_date: formData.transaction_date,
        due_date: formData.payment_due_date,
        transaction_type: 'purchase' as const,
        status: 'draft' as const,
        memo: formData.notes || '',
        total_amount: grandTotal,
        subtotal: grandSubtotal,
        tax_amount: grandTax,
        parent_order_id: null,
        transaction_items: itemsWithCalculatedTotals,
      };

      await createPurchaseOrderMutation.mutateAsync(transactionData);
      resetPurchaseForm();
      setShowForm(false);
      refetch();
    } catch (error) {
      console.error('Purchase order creation error:', error);
      toast.error('仕入伝票の作成に失敗しました');
    }
  };

  // CRUD操作関数
  async function createPurchaseOrder(newOrder: any) {
    const { transaction_items, ...orderData } = newOrder;

    // 現在のユーザーIDを取得して created_by に設定
    const currentUserId = user?.id;
    if (!currentUserId) {
      throw new Error('ユーザー情報が取得できません');
    }

    const dataToInsert = {
      ...orderData,
      created_by: currentUserId
    };

    console.log('=== データベース送信直前診断 ===');
    console.log('送信するpartner_id:', orderData.partner_id);
    console.log('送信するparent_order_id:', orderData.parent_order_id || null);
    console.log('送信するcreated_by:', currentUserId);
    console.log('総額:', orderData.total_amount);
    console.log('明細数:', transaction_items.length);
    console.log('===============================');

    const { data: order, error } = await supabase
      .from('transactions')
      .insert([dataToInsert])
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

  // 仕入先オプションをメモ化（React Select用）
  const partnerOptions = useMemo(() => {
    if (!partners) return [];
    return partners.map(partner => ({
      value: partner.id,
      label: `${partner.name} (${partner.partner_code})`
    }));
  }, [partners]);

  // フィルター適用後のデータ
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    return transactions.filter(transaction => {
      // ステータスフィルター
      if (statusFilter !== 'all') {
        if (statusFilter === 'draft' && transaction.status !== 'draft') return false;
        if (statusFilter === 'confirmed' && transaction.status !== 'confirmed') return false;
      }

      // 仕入先フィルター（selectedPartnerIdはhookで既に適用されているが、念のため）
      if (selectedPartnerId && transaction.partner_id !== selectedPartnerId) {
        return false;
      }

      // 日付範囲フィルター
      if (dateFrom && transaction.created_at < dateFrom) {
        return false;
      }
      if (dateTo && transaction.created_at > dateTo) {
        return false;
      }

      // 検索フィルター（hookで既に適用されているため、ここでは不要）
      return true;
    });
  }, [transactions, statusFilter, selectedPartnerId, dateFrom, dateTo]);

  // フィルタークリア
  const clearFilters = () => {
    setStatusFilter('all');
    setSelectedPartnerId('');
    setSearchKeyword('');
    setDateFrom('');
    setDateTo('');
  };

  // アクティブなフィルター数（検索は常時表示なので除外）
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (selectedPartnerId) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [statusFilter, selectedPartnerId, dateFrom, dateTo]);

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

  // 統計情報の計算（フィルター適用後のデータを使用）
  const totalTransactions = filteredTransactions.length;
  const totalAmount = filteredTransactions.reduce((sum, t) => sum + (t.transaction_total || 0), 0);
  const confirmedTransactions = filteredTransactions.filter(t => t.status === 'confirmed').length;
  const thisMonthTransactions = filteredTransactions.filter(t => {
    const transactionDate = new Date(t.created_at);
    const now = new Date();
    return transactionDate.getMonth() === now.getMonth() &&
           transactionDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">仕入管理</h1>
            <p className="text-blue-100 mt-1 font-inter text-sm">仕入伝票の作成と管理</p>
          </div>
          <div className="flex items-center gap-3">
            <PageManual {...manuals.purchaseOrders} />
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center px-5 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-md hover:shadow-xl font-jakarta font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              新規仕入伝票
            </button>
          </div>
        </div>
      </div>

      {/* 統計サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総取引数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalTransactions}</p>
              {activeFilterCount > 0 && (
                <p className="text-xs text-gray-500 mt-1">（全{transactions?.length || 0}件中）</p>
              )}
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総仕入額</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">¥{totalAmount.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">累計金額</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">確定済み件数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{confirmedTransactions}</p>
              <p className="text-xs text-gray-500 mt-1">確定済み</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">今月の取引</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{thisMonthTransactions}</p>
              <p className="text-xs text-gray-500 mt-1">当月分</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Package className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 仕入伝票入力フォーム */}
      {showForm && (
        <form onSubmit={handlePurchaseSubmit(onSubmitPurchaseOrder)} className="bg-white p-6 rounded-lg shadow-md space-y-6">
          <h2 className="text-2xl font-bold text-gray-800">新規仕入伝票</h2>

          {/* 基本情報 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="仕入先"
              required
              error={purchaseErrors.supplier_id}
            >
              <select
                {...register('supplier_id')}
                className="block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="">仕入先を選択してください</option>
                {partners?.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name} ({partner.partner_code})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="伝票番号"
              required
              error={purchaseErrors.invoice_no}
            >
              <FormInput
                type="text"
                placeholder="INV-001"
                error={purchaseErrors.invoice_no}
                {...register('invoice_no')}
              />
            </FormField>

            <FormField
              label="取引日"
              required
              error={purchaseErrors.transaction_date}
              icon={<Calendar className="w-4 h-4" />}
            >
              <FormInput
                type="date"
                error={purchaseErrors.transaction_date}
                {...register('transaction_date')}
              />
            </FormField>

            <FormField
              label="支払期日"
              required
              error={purchaseErrors.payment_due_date}
              icon={<Calendar className="w-4 h-4" />}
            >
              <FormInput
                type="date"
                error={purchaseErrors.payment_due_date}
                {...register('payment_due_date')}
              />
            </FormField>
          </div>

          {/* 商品明細 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">商品明細</h3>
              <button
                type="button"
                onClick={() => append({ product_id: '', quantity: 1, unit_price: 0, tax_rate: 10 })}
                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                明細追加
              </button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">明細 #{index + 1}</span>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">商品</label>
                    <select
                      {...register(`items.${index}.product_id`)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      onChange={(e) => {
                        const product = products?.find(p => p.id === e.target.value);
                        if (product) {
                          setPurchaseValue(`items.${index}.unit_price`, product.purchase_price || 0);

                          // 税率を自動設定
                          if (product.tax_category) {
                            const taxRate = getTaxRate(product.tax_category);
                            setPurchaseValue(`items.${index}.tax_rate`, taxRate);
                            console.log(`商品選択: ${product.product_name}, 税率区分: ${product.tax_category}, 税率: ${taxRate}%`);
                          }
                        }
                      }}
                    >
                      <option value="">商品を選択</option>
                      {products?.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.product_code})
                        </option>
                      ))}
                    </select>
                    {purchaseErrors.items?.[index]?.product_id && (
                      <p className="mt-1 text-sm text-red-600">{purchaseErrors.items[index]?.product_id?.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                    <input
                      type="number"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      min="1"
                    />
                    {purchaseErrors.items?.[index]?.quantity && (
                      <p className="mt-1 text-sm text-red-600">{purchaseErrors.items[index]?.quantity?.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">単価</label>
                    <input
                      type="number"
                      {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      min="0"
                      step="0.01"
                    />
                    {purchaseErrors.items?.[index]?.unit_price && (
                      <p className="mt-1 text-sm text-red-600">{purchaseErrors.items[index]?.unit_price?.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">税率(%)</label>
                    <input
                      type="number"
                      {...register(`items.${index}.tax_rate`, { valueAsNumber: true })}
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 備考 */}
          <FormField label="備考" error={purchaseErrors.notes}>
            <FormTextarea
              rows={3}
              placeholder="備考を入力（任意）"
              error={purchaseErrors.notes}
              {...register('notes')}
            />
          </FormField>

          {/* アクションボタン */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetPurchaseForm();
              }}
              className="px-6 py-2 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPurchaseSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPurchaseSubmitting ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  登録中...
                </span>
              ) : (
                '仕入伝票を登録'
              )}
            </button>
          </div>
        </form>
      )}

      {/* フィルターセクション */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="space-y-4">
          {/* 検索バーとフィルタートグル */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="発注番号、備考、取引IDで検索..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="検索をクリア"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                showFilters
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-5 h-5" />
              フィルター
              {activeFilterCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-white text-blue-600 text-xs font-bold rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* フィルター詳細（トグル可能） */}
          {showFilters && (
            <div className="pt-4 border-t border-gray-200 space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* ステータスフィルター */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ステータス
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">すべて</option>
                    <option value="draft">下書き</option>
                    <option value="confirmed">確定済み</option>
                  </select>
                </div>

                {/* 仕入先フィルター（React Select） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    仕入先
                  </label>
                  <Select
                    isClearable
                    placeholder="仕入先を選択..."
                    value={partnerOptions.find(option => option.value === selectedPartnerId) || null}
                    onChange={(option) => handlePartnerSelect(option?.value || '')}
                    options={partnerOptions}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderColor: '#d1d5db',
                        '&:hover': { borderColor: '#9ca3af' },
                      }),
                    }}
                  />
                </div>

                {/* 日付範囲フィルター */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    開始日
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    終了日
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* フィルタークリアボタン */}
              {activeFilterCount > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    フィルターをクリア
                  </button>
                </div>
              )}
            </div>
          )}

          {/* フィルター結果表示 */}
          <div className="text-sm text-gray-600">
            {filteredTransactions.length}件の取引が見つかりました
            {activeFilterCount > 0 && ` (全${transactions?.length || 0}件中)`}
          </div>
        </div>
      </div>

      {/* ✅ 修正：取引一覧テーブル */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">取引一覧</h2>
        </div>

        {overallLoading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 inline-block">
              <p className="text-red-800 font-semibold">データの取得に失敗しました</p>
              <p className="text-red-600 text-sm mt-2">{error}</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                再試行
              </button>
            </div>
          </div>
        ) : !filteredTransactions || filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {activeFilterCount > 0
              ? 'フィルター条件に一致する取引がありません'
              : '取引データがありません'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
            <table className="min-w-full border-collapse">
              <thead className="bg-gradient-to-b from-slate-50 to-slate-100 border-b-2 border-slate-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  {/* CRITICAL: 伝票番号 - 伝票識別に必須 */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    伝票番号
                  </th>
                  {/* 取引日付 - 時系列情報 */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    取引日付
                  </th>
                  {/* CRITICAL: 仕入先名 - 「誰から」の情報 */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    仕入先
                  </th>
                  {/* 親発注情報（納品回数とステータスを含む） */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    親発注
                  </th>
                  {/* CRITICAL: 金額 - 最も重要な数値 */}
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    金額
                  </th>
                  {/* CRITICAL: 支払期日 - アクション期限 */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    支払期日
                  </th>
                  {/* ステータス - 現在の状態 */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    ステータス
                  </th>
                  {/* 備考 - 補足情報 */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap hidden lg:table-cell">
                    備考
                  </th>
                  {/* 登録者 - ワークフロー追跡 */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap hidden xl:table-cell">
                    登録者
                  </th>
                  {/* 操作 */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 whitespace-nowrap">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredTransactions.map((transaction, index) => (
                  <tr key={transaction.id} className={`transition-all duration-150 hover:bg-blue-50 hover:shadow-sm ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    {/* CRITICAL: 伝票番号 */}
                    <td className="px-3 py-2 text-xs font-medium border-r border-slate-200 whitespace-nowrap">
                      {transaction.transaction_no ? (
                        <Link
                          to={`/transactions/${transaction.id}`}
                          state={savePageState({
                            filters: {
                              selectedPartnerId,
                              statusFilter,
                              searchKeyword,
                              dateFrom,
                              dateTo,
                              showFilters,
                            },
                          })}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {transaction.transaction_no}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs italic">未発番</span>
                      )}
                    </td>

                    {/* 取引日付 */}
                    <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {new Date(transaction.created_at).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }).replace(/\//g, '/')}
                    </td>

                    {/* CRITICAL: 仕入先名 */}
                    <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold">{transaction.partner_name || '不明'}</span>
                        {transaction.partner_code && (
                          <span className="text-xs text-gray-500">{transaction.partner_code}</span>
                        )}
                      </div>
                    </td>

                    {/* 親発注 */}
                    <td className="px-3 py-2 text-xs border-r border-slate-200 whitespace-nowrap">
                      <ParentOrderCell transaction={transaction} />
                    </td>

                    {/* CRITICAL: 金額 */}
                    <td className="px-3 py-2 text-xs font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap text-right">
                      ¥{Number(transaction.transaction_total || 0).toLocaleString()}
                    </td>

                    {/* CRITICAL: 支払期日 */}
                    <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {transaction.payment_due_date ? (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {new Date(transaction.payment_due_date).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                          </span>
                          {/* 期限までの日数を表示 */}
                          {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const dueDate = new Date(transaction.payment_due_date);
                            dueDate.setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                            if (diffDays < 0) {
                              return <span className="text-xs text-red-600 font-semibold">期限超過 ({Math.abs(diffDays)}日)</span>;
                            } else if (diffDays === 0) {
                              return <span className="text-xs text-orange-600 font-semibold">本日期限</span>;
                            } else if (diffDays <= 7) {
                              return <span className="text-xs text-orange-500">残り{diffDays}日</span>;
                            } else if (diffDays <= 14) {
                              return <span className="text-xs text-blue-500">残り{diffDays}日</span>;
                            } else {
                              return <span className="text-xs text-gray-500">残り{diffDays}日</span>;
                            }
                          })()}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">未設定</span>
                      )}
                    </td>

                    {/* ステータス */}
                    <td className="px-3 py-2 text-xs border-r border-slate-200 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-md ${
                        transaction.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {transaction.status === 'confirmed' ? '確定' : '下書き'}
                      </span>
                    </td>

                    {/* 備考 (hidden on tablets, shown on large screens) */}
                    <td className="px-3 py-2 text-xs text-slate-600 border-r border-slate-200 hidden lg:table-cell max-w-xs">
                      <div className="truncate" title={transaction.notes || ''}>
                        {transaction.notes || <span className="text-gray-400 italic">なし</span>}
                      </div>
                    </td>

                    {/* 登録者 (hidden on tablets, shown on XL screens) */}
                    <td className="px-3 py-2 text-xs text-slate-700 border-r border-slate-200 whitespace-nowrap hidden xl:table-cell">
                      {transaction.created_by_name || <span className="text-gray-400 italic">不明</span>}
                    </td>

                    {/* 操作 */}
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-center">
                      <div className="flex justify-center gap-1.5">
                        {transaction.status === 'draft' && (
                          <button
                            onClick={() => handleConfirm(transaction)}
                            disabled={isConfirming}
                            className={`px-2 py-1 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors ${isConfirming ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="取引を確定"
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