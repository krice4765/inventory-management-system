import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { OrderManagerSelect } from '../OrderManagerSelect';
import SearchableSelect from '../SearchableSelect';
import { useDarkMode } from '../../hooks/useDarkMode';
import toast from 'react-hot-toast';

// **発注番号生成ヘルパー関数**
const generateOrderNo = (): string => {
  const d = new Date();
  const ymd = d.toISOString().slice(0,10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000); // 4桁ランダム
  return `PO-${ymd}-${rand}`;
};

// **型定義**
interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  product_name: string;
  standard_price: number;
}

interface OrderItem {
  product_id: string;
  quantity: number | string;
  unit_price: number;
  note?: string;
}

interface PurchaseOrderFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({ 
  onSuccess, 
  onCancel 
}) => {
  const queryClient = useQueryClient();
  const { isDark } = useDarkMode();

  // **基本フォーム状態**
  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [supplierId, setSupplierId] = useState<string>('');
  const [orderManagerId, setOrderManagerId] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // **明細行状態**
  const [items, setItems] = useState<OrderItem[]>([
    { product_id: '', quantity: 1, unit_price: 0, note: '' }
  ]);

  // **データ取得状態**
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // **数値変換ヘルパー（NaN防止）**
  const toNumber = (value: unknown): number => {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  };

  // **データ取得（仕入先・商品）**
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // 仕入先データ取得
        const { data: suppliersData, error: suppliersError } = await supabase
          .from('partners')
          .select('id, name')
          .order('name', { ascending: true });

        if (suppliersError) {
          console.warn('Suppliers fetch error:', suppliersError);
          setSuppliers([]);
        } else {
          setSuppliers(suppliersData || []);
        }

        // 商品データ取得
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, product_name, standard_price')
          .order('product_name', { ascending: true });

        if (productsError) {
          console.warn('Products fetch error:', productsError);
          setProducts([]);
        } else {
          setProducts(productsData || []);
        }

      } catch (err: unknown) {
        console.error('Data fetch error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`データ取得エラー: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // **明細行更新ハンドラー**
  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      const updatedItem = { ...newItems[index] };

      if (field === 'product_id') {
        // 商品選択時に単価を自動設定
        const selectedProduct = products.find(p => p.id === value);
        updatedItem.product_id = value;
        updatedItem.unit_price = selectedProduct ? selectedProduct.standard_price : 0;
      } else {
        updatedItem[field] = value;
      }

      newItems[index] = updatedItem;
      return newItems;
    });
  };

  // **明細行操作**
  const addItem = () => {
    setItems(prev => [...prev, { product_id: '', quantity: 1, unit_price: 0, note: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  // **🧮 自動計算（useMemoで最適化）**
  const calculations = useMemo(() => {
    let subtotal = 0;
    
    // 各明細行の小計を計算
    const itemsWithSubtotal = items.map(item => {
      const qty = toNumber(item.quantity);
      const price = toNumber(item.unit_price);
      const lineSubtotal = qty * price;
      subtotal += lineSubtotal;
      
      return { ...item, lineSubtotal };
    });

    const taxRate = 0.10; // 消費税10%
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal + tax;

    return {
      itemsWithSubtotal,
      subtotal,
      tax,
      total
    };
  }, [items]);

  // **エラーメッセージ抽出ヘルパー関数**
  const extractSupabaseError = (err: unknown): string => {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (typeof err === 'object') {
      const e = err as Record<string, unknown>;
      return e?.message as string || e?.error_description as string || e?.error as string || e?.hint as string || JSON.stringify(e, null, 2);
    }
    return String(err);
  };

  // **フォーム送信**
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (!supplierId) {
      toast.error('仕入先を選択してください');
      return;
    }
    if (!orderManagerId) {
      toast.error('発注担当者を選択してください');
      return;
    }
    if (items.some(item => !item.product_id || toNumber(item.quantity) <= 0)) {
      toast.error('すべての明細行で商品を選択し、数量を正しく入力してください');
      return;
    }

    try {
      // **データベーススキーマに完全対応した送信データ**
      const orderData = {
        order_no: generateOrderNo(),                 // 必須フィールド
        partner_id: supplierId,                      // UUID
        order_manager_id: orderManagerId,            // UUID
        order_date: orderDate,                       // transaction_date → order_date
        delivery_deadline: expectedDate || null,     // due_date → delivery_deadline
        total_amount: Number(calculations.total),    // 数値型に明示変換
        memo: notes?.trim() || null,                // notes → memo
        status: 'active'                            // デフォルトステータス
        // transaction_type は存在しないため送信しない
      };

      console.log('🚀 [PurchaseOrder] データベース対応送信データ:', orderData);
      console.log('🚀 [PurchaseOrder] フィールドマッピング確認:', {
        'order_date (DB)': orderData.order_date,
        'delivery_deadline (DB)': orderData.delivery_deadline,
        'memo (DB)': orderData.memo,
        'order_no': orderData.order_no,
        'total_amount_type': typeof orderData.total_amount
      });

      // **Supabase挿入処理**
      const { data: newOrder, error: orderError } = await supabase
        .from('purchase_orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error('❌ [PurchaseOrder] Supabaseエラー詳細:', orderError);
        console.error('❌ [PurchaseOrder] エラーコード:', orderError.code);
        console.error('❌ [PurchaseOrder] エラーメッセージ:', orderError.message);
        toast.error(`発注作成に失敗: ${extractSupabaseError(orderError)}`);
        return;
      }

      console.log('✅ [PurchaseOrder] 作成成功:', newOrder);

      // **🆕 明細レコードの保存**
      const orderItemsData = items.map(item => {
        const quantity = toNumber(item.quantity);
        const unitPrice = toNumber(item.unit_price);
        return {
          purchase_order_id: newOrder.id,
          product_id: item.product_id,
          quantity: quantity,
          unit_price: unitPrice,
          total_amount: quantity * unitPrice
        };
      });

      console.log('🚀 [OrderItems] 明細保存データ:', orderItemsData);

      // 🛡️ 重複商品検証
      const productIds = orderItemsData.map(item => item.product_id);
      const uniqueProductIds = [...new Set(productIds)];
      if (productIds.length !== uniqueProductIds.length) {
        throw new Error('同一商品を複数回追加することはできません');
      }

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItemsData);

      if (itemsError) {
        console.error('❌ [OrderItems] 明細保存エラー:', itemsError);
        // 発注は作成済みなので、明細エラーは警告レベル
        toast.error(`発注は作成されましたが、明細保存でエラーが発生しました: ${extractSupabaseError(itemsError)}`);
      } else {
        console.log('✅ [OrderItems] 明細保存成功');
      }

      // **🚨 データベーストリガーを使用するため、以下の処理を削除**
      // transactions への直接INSERT処理は不要（トリガーが自動実行）

      toast.success('新規発注と明細を正常に作成しました！');

      // **包括的キャッシュ無効化（維持）**
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['transactionsByPartner'] }),
          queryClient.invalidateQueries({ queryKey: ['transactionsWithPartners'] }),
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
          queryClient.invalidateQueries({ queryKey: ['v_unified_purchase_display'] })
        ]);

        await queryClient.invalidateQueries({
          predicate: (query) => {
            const keyString = JSON.stringify(query.queryKey).toLowerCase();
            return /transaction|purchase|order|stats|dashboard|unified/i.test(keyString);
          }
        });

        console.log('✅ [Cache] 統合キャッシュ同期完了');
      } catch (cacheError) {
        console.warn('⚠️ [Cache] キャッシュ更新エラー:', cacheError);
      }

      onSuccess();

    } catch (err: unknown) {
      console.error('❌ [PurchaseOrder] 予期しないエラー:', err);
      const errorMessage = extractSupabaseError(err);
      toast.error(`発注作成に失敗: ${errorMessage}`);
    }
  };

  // **ローディング・エラー表示**
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600 dark:text-gray-400">データを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 text-sm text-red-700 dark:text-red-300 underline"
        >
          ページを再読み込み
        </button>
      </div>
    );
  }

  // **メインフォームUI**
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* **基本情報セクション** */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            仕入先 <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={suppliers.map(supplier => ({
              value: supplier.id,
              label: supplier.name,
              description: `仕入先ID: ${supplier.id}`
            }))}
            value={supplierId}
            onChange={setSupplierId}
            placeholder="仕入先を選択してください"
            required
            darkMode={isDark}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            発注日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            納入予定日
          </label>
          <input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* **発注担当者選択** */}
      <OrderManagerSelect
        value={orderManagerId}
        onChange={setOrderManagerId}
        required={true}
        className="w-full"
      />

      {/* **明細セクション** */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">明細</h3>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            ➕ 行追加
          </button>
        </div>

        <div className="space-y-3">
          {calculations.itemsWithSubtotal.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="col-span-4">
                <SearchableSelect
                  options={products.map(product => ({
                    value: product.id,
                    label: product.product_name,
                    description: `標準価格: ¥${Number(product.standard_price || 0).toLocaleString()}`
                  }))}
                  value={item.product_id}
                  onChange={(value) => updateItem(index, 'product_id', value)}
                  placeholder="商品を選択"
                  required
                  darkMode={isDark}
                  className="text-sm"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm text-right bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="数量"
                  required
                />
              </div>
              <div className="col-span-2">
                <div className="text-sm text-right text-gray-600 dark:text-gray-300 py-1.5">
                  ¥{toNumber(item.unit_price).toLocaleString()}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-sm text-right font-medium text-gray-900 dark:text-white py-1.5">
                  ¥{item.lineSubtotal.toLocaleString()}
                </div>
              </div>
              <div className="col-span-2 text-right">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 text-sm"
                  disabled={items.length <= 1}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* **🧮 合計表示セクション** */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <div className="space-y-2 text-right">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">小計:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ¥{calculations.subtotal.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">消費税 (10%):</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ¥{calculations.tax.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span className="text-gray-900 dark:text-white">合計:</span>
            <span className="text-blue-600 dark:text-blue-400">
              ¥{calculations.total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* **備考** */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          備考
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="備考を入力してください"
        />
      </div>

      {/* **アクションボタン** */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          発注を作成
        </button>
      </div>
    </form>
  );
};