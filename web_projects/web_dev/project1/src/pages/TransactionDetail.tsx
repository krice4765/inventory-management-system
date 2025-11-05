import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, User, FileText, CreditCard, CheckCircle, XCircle, Edit2, Save, X as XIcon, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TransactionWithParent } from '../types/purchase';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../types/purchase';
import { useProducts } from '../hooks/useProducts';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';

// 取引明細行の型定義
interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  product: {
    id: string;
    product_name: string;
    product_code: string;
    unit: string;
  };
}

// 買掛金情報の型定義
interface AccountsPayable {
  id: string;
  invoice_no: string;
  document_number?: string;
  expense_category?: string;
  planned_payment_date?: string;
  payment_method?: 'bank_transfer' | 'promissory_note' | 'cash' | 'card';
  approval_status?: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

// 拡張された取引詳細の型定義
interface TransactionDetail extends TransactionWithParent {
  items: TransactionItem[];
  accounts_payable?: AccountsPayable;
}

// データ取得関数
const fetchTransactionDetail = async (id: string): Promise<TransactionDetail> => {
  // 取引情報を取得（transactionsテーブルから直接取得してパートナー情報を結合）
  const { data: transactionData, error: transactionError } = await supabase
    .from('transactions')
    .select(`
      *,
      partners:partner_id (
        id,
        name,
        partner_code
      ),
      users:created_by (
        id,
        display_name
      )
    `)
    .eq('id', id)
    .single();

  if (transactionError) {
    throw new Error(`取引情報の取得に失敗しました: ${transactionError.message}`);
  }

  if (!transactionData) {
    throw new Error('取引が見つかりません');
  }

  // ビュー形式のデータに変換
  const formattedTransaction = {
    ...transactionData,
    partner_name: transactionData.partners?.name,
    partner_code: transactionData.partners?.partner_code,
    created_by_name: transactionData.users?.display_name || 'Unknown',
  };

  // 取引明細を取得
  const { data: itemsData, error: itemsError } = await supabase
    .from('transaction_items')
    .select(`
      id,
      product_id,
      quantity,
      unit_price,
      total_amount,
      product:products (
        id,
        product_name,
        product_code,
        unit
      )
    `)
    .eq('transaction_id', id)
    .order('created_at', { ascending: true });

  if (itemsError) {
    throw new Error(`明細情報の取得に失敗しました: ${itemsError.message}`);
  }

  // 買掛金情報を取得
  const { data: accountsPayableData, error: accountsPayableError } = await supabase
    .from('accounts_payable')
    .select('*')
    .eq('purchase_transaction_id', id)
    .eq('source_table', 'transactions')
    .maybeSingle();

  if (accountsPayableError) {
    console.error('買掛金情報の取得に失敗:', accountsPayableError);
  }

  return {
    ...formattedTransaction,
    items: itemsData || [],
    accounts_payable: accountsPayableData || undefined,
  };
};

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();

  // 編集モード状態
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({
    transaction_date: '',
    payment_due_date: '',
    expense_category: '' as ExpenseCategory | '',
    notes: '',
  });
  const [editItems, setEditItems] = useState<Array<{
    id?: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    notes?: string;
  }>>([]);

  const { data: transaction, isLoading, error } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => fetchTransactionDetail(id!),
    enabled: !!id,
  });

  // 編集フォームに初期データをセット
  useEffect(() => {
    if (transaction) {
      setEditFormData({
        transaction_date: transaction.transaction_date || new Date().toISOString().split('T')[0],
        payment_due_date: transaction.payment_due_date || '',
        expense_category: (transaction.expense_category as ExpenseCategory) || '',
        notes: transaction.notes || '',
      });
      setEditItems(
        transaction.items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: '',
        }))
      );
    }
  }, [transaction]);

  // 承認ミューテーション
  const approveMutation = useMutation({
    mutationFn: async (accountsPayableId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ユーザー情報を取得できません');

      const { error } = await supabase
        .from('accounts_payable')
        .update({
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', accountsPayableId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('承認が完了しました');
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
    },
    onError: (error) => {
      console.error('Approval error:', error);
      toast.error('承認処理に失敗しました');
    },
  });

  // 却下ミューテーション
  const rejectMutation = useMutation({
    mutationFn: async (accountsPayableId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ユーザー情報を取得できません');

      const { error } = await supabase
        .from('accounts_payable')
        .update({
          approval_status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', accountsPayableId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('却下が完了しました');
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
    },
    onError: (error) => {
      console.error('Rejection error:', error);
      toast.error('却下処理に失敗しました');
    },
  });

  const handleApprove = () => {
    if (!transaction?.accounts_payable?.id) {
      toast.error('買掛金情報が見つかりません');
      return;
    }
    if (window.confirm('この買掛金を承認しますか?')) {
      approveMutation.mutate(transaction.accounts_payable.id);
    }
  };

  const handleReject = () => {
    if (!transaction?.accounts_payable?.id) {
      toast.error('買掛金情報が見つかりません');
      return;
    }
    if (window.confirm('この買掛金を却下しますか?')) {
      rejectMutation.mutate(transaction.accounts_payable.id);
    }
  };

  // 保存ミューテーション
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('取引IDが見つかりません');

      // 取引ヘッダー情報を更新
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          transaction_date: editFormData.transaction_date,
          payment_due_date: editFormData.payment_due_date || null,
          expense_category: editFormData.expense_category || null,
          notes: editFormData.notes || null,
        })
        .eq('id', id);

      if (transactionError) throw transactionError;

      // 既存の明細を削除
      const { error: deleteError } = await supabase
        .from('transaction_items')
        .delete()
        .eq('transaction_id', id);

      if (deleteError) throw deleteError;

      // 新しい明細を挿入
      const itemsToInsert = editItems
        .filter(item => item.product_id && item.quantity > 0 && item.unit_price >= 0)
        .map(item => ({
          transaction_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.quantity * item.unit_price,
          notes: item.notes || null,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('transaction_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // 合計金額を再計算して更新
      const totalAmount = itemsToInsert.reduce((sum, item) => sum + item.total_amount, 0);
      const { error: updateTotalError } = await supabase
        .from('transactions')
        .update({ total_amount: totalAmount })
        .eq('id', id);

      if (updateTotalError) throw updateTotalError;
    },
    onSuccess: () => {
      toast.success('保存が完了しました');
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
    },
    onError: (error) => {
      console.error('Save error:', error);
      const errorMessage = error instanceof Error ? error.message : '保存に失敗しました';
      toast.error(`保存に失敗しました: ${errorMessage}`);
    },
  });

  // 明細行追加
  const handleAddItem = () => {
    setEditItems([...editItems, { product_id: '', quantity: 1, unit_price: 0, notes: '' }]);
  };

  // 明細行削除
  const handleRemoveItem = (index: number) => {
    if (editItems.length > 1) {
      setEditItems(editItems.filter((_, i) => i !== index));
    } else {
      toast.error('明細行は最低1行必要です');
    }
  };

  // 明細行変更
  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...editItems];
    newItems[index] = { ...newItems[index], [field]: value };

    // 商品選択時に単価を自動入力
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unit_price = Number(product.purchase_price);
      }
    }

    setEditItems(newItems);
  };

  // 編集モード切り替え
  const handleEditToggle = () => {
    if (isEditMode) {
      // キャンセル時は元のデータに戻す
      if (transaction) {
        setEditFormData({
          transaction_date: transaction.transaction_date || new Date().toISOString().split('T')[0],
          payment_due_date: transaction.payment_due_date || '',
          expense_category: (transaction.expense_category as ExpenseCategory) || '',
          notes: transaction.notes || '',
        });
        setEditItems(
          transaction.items.map(item => ({
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: '',
          }))
        );
      }
      setIsEditMode(false);
    } else {
      setIsEditMode(true);
    }
  };

  // 保存実行
  const handleSave = () => {
    if (editItems.filter(item => item.product_id && item.quantity > 0).length === 0) {
      toast.error('有効な明細行を少なくとも1つ入力してください');
      return;
    }
    if (window.confirm('変更を保存しますか?')) {
      saveMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">
          {error instanceof Error ? error.message : '取引情報の読み込みに失敗しました'}
        </p>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">取引が見つかりません</p>
      </div>
    );
  }

  // ステータスバッジのスタイル
  const statusStyle = transaction.status === 'confirmed'
    ? 'bg-green-100 text-green-800'
    : 'bg-yellow-100 text-yellow-800';

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              const savedState = location.state as any;
              const from = savedState?.fromPath || '/purchase-orders';
              navigate(from, { state: savedState });
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">仕入伝票詳細</h1>
            <p className="text-sm text-gray-500 mt-1">
              伝票番号: {transaction.transaction_no || '未発番'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusStyle}`}>
            {transaction.status === 'confirmed' ? '確定' : '下書き'}
          </span>
          {!isEditMode ? (
            <button
              onClick={handleEditToggle}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              編集
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleEditToggle}
                disabled={saveMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <XIcon className="w-4 h-4 mr-2" />
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 基本情報カード */}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">基本情報</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 仕入先情報 */}
          <div className="space-y-2">
            <div className="flex items-center text-sm font-medium text-gray-500">
              <Package className="w-4 h-4 mr-2" />
              仕入先
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">
                {transaction.partner_name || '不明'}
              </p>
              {transaction.partner_code && (
                <p className="text-sm text-gray-500">{transaction.partner_code}</p>
              )}
            </div>
          </div>

          {/* 取引日付 */}
          <div className="space-y-2">
            <div className="flex items-center text-sm font-medium text-gray-500">
              <Calendar className="w-4 h-4 mr-2" />
              取引日付
            </div>
            {isEditMode ? (
              <input
                type="date"
                value={editFormData.transaction_date}
                onChange={(e) => setEditFormData({ ...editFormData, transaction_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            ) : (
              <p className="text-base text-gray-900">
                {new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </p>
            )}
          </div>

          {/* 支払予定日 */}
          <div className="space-y-2">
            <div className="flex items-center text-sm font-medium text-gray-500">
              <CreditCard className="w-4 h-4 mr-2" />
              支払予定日
            </div>
            {isEditMode ? (
              <input
                type="date"
                value={editFormData.payment_due_date}
                onChange={(e) => setEditFormData({ ...editFormData, payment_due_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            ) : (
              <p className="text-base text-gray-900">
                {transaction.payment_due_date
                  ? new Date(transaction.payment_due_date).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })
                  : '未設定'}
              </p>
            )}
          </div>

          {/* 経費科目 */}
          {(isEditMode || transaction.expense_category) && (
            <div className="space-y-2">
              <div className="flex items-center text-sm font-medium text-gray-500">
                <FileText className="w-4 h-4 mr-2" />
                経費科目
              </div>
              {isEditMode ? (
                <select
                  value={editFormData.expense_category}
                  onChange={(e) => setEditFormData({ ...editFormData, expense_category: e.target.value as ExpenseCategory | '' })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">選択してください</option>
                  {EXPENSE_CATEGORIES.map(category => (
                    <option key={category.code} value={category.code}>
                      {category.icon} {category.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-base text-gray-900">
                  {transaction.expense_category || '-'}
                </p>
              )}
            </div>
          )}

          {/* 登録者 */}
          <div className="space-y-2">
            <div className="flex items-center text-sm font-medium text-gray-500">
              <User className="w-4 h-4 mr-2" />
              登録者
            </div>
            <p className="text-base text-gray-900">
              {transaction.created_by_name || '不明'}
            </p>
          </div>
        </div>

        {/* 親発注情報 */}
        {transaction.parent_order_id && (
          <div className="pt-4 border-t">
            <div className="flex items-center text-sm font-medium text-gray-500 mb-2">
              <FileText className="w-4 h-4 mr-2" />
              親発注情報
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm">
                <span className="font-medium">発注番号:</span>{' '}
                {transaction.parent_order_code}
                {transaction.delivery_sequence && (
                  <span className="ml-2 text-gray-600">
                    (第{transaction.delivery_sequence}回)
                  </span>
                )}
              </p>
              <p className="text-sm">
                <span className="font-medium">発注日:</span>{' '}
                {transaction.parent_order_date
                  ? new Date(transaction.parent_order_date).toLocaleDateString('ja-JP')
                  : '不明'}
              </p>
              <p className="text-sm">
                <span className="font-medium">発注金額:</span>{' '}
                ¥{Number(transaction.parent_order_total || 0).toLocaleString()}
              </p>
              <p className="text-sm">
                <span className="font-medium">残額:</span>{' '}
                ¥{Number(transaction.parent_order_remaining || 0).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* 備考 */}
        {(isEditMode || transaction.notes) && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium text-gray-500 mb-2">備考</div>
            {isEditMode ? (
              <textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="伝票に関する備考"
              />
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">{transaction.notes}</p>
            )}
          </div>
        )}
      </div>

      {/* 買掛金情報カード */}
      {transaction.accounts_payable && (
        <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-lg font-semibold text-gray-900">買掛金情報</h2>
            {transaction.accounts_payable.approval_status === 'approved' && (
              <span className="px-3 py-1 text-sm font-semibold rounded-md bg-green-100 text-green-800">
                承認済
              </span>
            )}
            {transaction.accounts_payable.approval_status === 'rejected' && (
              <span className="px-3 py-1 text-sm font-semibold rounded-md bg-red-100 text-red-800">
                却下
              </span>
            )}
            {transaction.accounts_payable.approval_status === 'pending' && (
              <span className="px-3 py-1 text-sm font-semibold rounded-md bg-yellow-100 text-yellow-800">
                未承認
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 支払予定日 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">支払予定日</div>
              <p className="text-base text-gray-900">
                {transaction.accounts_payable.planned_payment_date
                  ? new Date(transaction.accounts_payable.planned_payment_date).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })
                  : '-'}
              </p>
            </div>

            {/* 経費科目 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">経費科目</div>
              <p className="text-base text-gray-900">
                {transaction.accounts_payable.expense_category || '-'}
              </p>
            </div>

            {/* 支払方法 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">支払方法</div>
              <p className="text-base text-gray-900">
                {transaction.accounts_payable.payment_method === 'bank_transfer' ? '銀行振込' :
                 transaction.accounts_payable.payment_method === 'promissory_note' ? '手形' :
                 transaction.accounts_payable.payment_method === 'cash' ? '現金' :
                 transaction.accounts_payable.payment_method === 'card' ? 'カード' : '-'}
              </p>
            </div>

            {/* 伝票番号 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-500">伝票番号</div>
              <p className="text-base text-gray-900">
                {transaction.accounts_payable.document_number || '-'}
              </p>
            </div>
          </div>

          {/* 承認者情報（承認済み・却下の場合のみ表示） */}
          {transaction.accounts_payable.approved_by && transaction.accounts_payable.approved_at && (
            <div className="pt-4 border-t">
              <div className="text-sm font-medium text-gray-500 mb-2">
                {transaction.accounts_payable.approval_status === 'approved' ? '承認者情報' : '却下者情報'}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-700">
                  承認者ID: {transaction.accounts_payable.approved_by}
                </p>
                <p className="text-sm text-gray-700">
                  {transaction.accounts_payable.approval_status === 'approved' ? '承認日時' : '却下日時'}: {
                    new Date(transaction.accounts_payable.approved_at).toLocaleString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }
                </p>
              </div>
            </div>
          )}

          {/* 承認ボタン（未承認の場合のみ表示） */}
          {transaction.accounts_payable.approval_status === 'pending' && (
            <div className="pt-4 border-t flex justify-end gap-3">
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {rejectMutation.isPending ? '処理中...' : '却下'}
              </button>
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {approveMutation.isPending ? '処理中...' : '承認'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 明細テーブル */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">明細</h2>
          {isEditMode && (
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus size={16} className="mr-1" />
              行追加
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  商品
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  数量
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  単価
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金額
                </th>
                {isEditMode && (
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isEditMode ? (
                editItems.map((item, index) => {
                  const product = products.find(p => p.id === item.product_id);
                  const lineTotal = Number(item.quantity) * Number(item.unit_price);
                  return (
                    <tr key={index}>
                      <td className="px-6 py-4">
                        <select
                          className="w-full min-w-[200px] rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          value={item.product_id}
                          onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        >
                          <option value="">選択してください</option>
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.product_code})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min="1"
                          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', Number(e.target.value))}
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        ¥{lineTotal.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          disabled={editItems.length === 1}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                transaction.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.product.product_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.product.product_code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.quantity.toLocaleString()} {item.product.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ¥{item.unit_price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      ¥{item.total_amount.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 合計金額カード */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-end">
          <div className="w-full md:w-1/2 space-y-3">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-xl font-bold text-gray-900">合計金額</span>
              <span className="text-2xl font-bold text-blue-600">
                ¥{isEditMode
                  ? editItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0).toLocaleString()
                  : Number(transaction.transaction_total || 0).toLocaleString()
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
