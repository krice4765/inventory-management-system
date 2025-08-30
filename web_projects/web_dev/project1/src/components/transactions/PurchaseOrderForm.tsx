import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useSuppliers } from '../../hooks/usePartners';
import { useCreatePurchaseOrder } from '../../hooks/useTransactions';
import type { TransactionItem } from '../../api/transactions';
import { formatJPY } from '../../utils/format';
import toast from 'react-hot-toast';

interface Props {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const PurchaseOrderForm: React.FC<Props> = ({ onSuccess, onCancel }) => {
  const { data: products = [] } = useProducts();
  const { data: suppliers = [] } = useSuppliers();
  const createMutation = useCreatePurchaseOrder();

  const [formData, setFormData] = useState({
    partner_id: null as number | null,
    transaction_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });

  const [items, setItems] = useState<Omit<TransactionItem, 'id' | 'transaction_id' | 'line_total' | 'products'>[]>([
    { product_id: 0, quantity: 1, unit_price: 0, notes: '' }
  ]);

  const handleAddItem = () => {
    setItems([...items, { product_id: 0, quantity: 1, unit_price: 0, notes: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      toast.error('明細行は最低1行必要です');
    }
  };

  const handleItemChange = (index: number, field: keyof TransactionItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unit_price = Number(product.purchase_price);
      }
    }

    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.partner_id) {
      toast.error('仕入先を選択してください');
      return;
    }

    const validItems = items.filter(item => item.product_id > 0 && item.quantity > 0 && item.unit_price >= 0);
    if (validItems.length === 0) {
      toast.error('有効な明細行を少なくとも1つ入力してください');
      return;
    }

    try {
      await createMutation.mutateAsync({
        transaction_type: 'purchase',
        partner_id: formData.partner_id,
        transaction_date: formData.transaction_date,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
        items: validItems,
      });
      onSuccess?.();
    } catch (error) {
      // エラーはmutationで処理
    }
  };

  const { subtotal, tax, total } = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ヘッダー情報 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            仕入先 <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            value={formData.partner_id || ''}
            onChange={(e) => setFormData({ ...formData, partner_id: Number(e.target.value) || null })}
            required
          >
            <option value="">選択してください</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name} ({supplier.partner_code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            仕入日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            value={formData.transaction_date}
            onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            支払期限
          </label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            備考
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="伝票に関する備考"
          />
        </div>
      </div>

      {/* 明細行 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900">明細</h3>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus size={16} className="mr-1" />
            行追加
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">商品</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">数量</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">単価</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">小計</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">備考</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="px-3 py-2">
                    <select
                      className="w-full min-w-[200px] rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      value={item.product_id}
                      onChange={(e) => handleItemChange(index, 'product_id', Number(e.target.value))}
                    >
                      <option value={0}>選択してください</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.product_code})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    />
                  </td>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2 text-right text-sm">
                    {formatJPY(Number(item.quantity) * Number(item.unit_price))}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      value={item.notes || ''}
                      onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                      placeholder="明細備考"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      disabled={items.length === 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-medium">小計:</td>
                <td className="px-3 py-2 text-right font-medium">{formatJPY(subtotal)}</td>
                <td colSpan={2}></td>
              </tr>
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-medium">消費税 (10%):</td>
                <td className="px-3 py-2 text-right font-medium">{formatJPY(tax)}</td>
                <td colSpan={2}></td>
              </tr>
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-bold text-lg">合計:</td>
                <td className="px-3 py-2 text-right font-bold text-lg text-indigo-600">{formatJPY(total)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? '作成中...' : '伝票作成'}
        </button>
      </div>
    </form>
  );
};
