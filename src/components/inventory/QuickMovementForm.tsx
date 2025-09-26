import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useProducts } from '../../hooks/useProducts';
import { useCreateInventoryMovement } from '../../hooks/useInventory';
import type { MovementType } from '../../api/inventory';
import toast from 'react-hot-toast';

interface Props {
      mode: 'in' | 'out'; onSuccess?: () => void; }

interface FormValues {
      product_id: number; quantity: number; unit_price: number; note: string; }

const schema = yup.object({
  product_id: yup.number().required('商品を選択してください'),
  quantity: yup.number().min(1, '1以上の数量を入力してください').required('数量は必須です'),
  unit_price: yup.number().min(0, '0以上の価格を入力してください').required('単価は必須です'),
  note: yup.string().max(500, '500文字以内で入力してください'),
});

export const QuickMovementForm: React.FC<Props> = ({ mode, onSuccess }) => {
  const { data: products = [], isLoading: isLoadingProducts } = useProducts();
  const createMutation = useCreateInventoryMovement();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch } = useForm<FormValues>({
    resolver: yupResolver(schema),
      defaultValues: { product_id: 0,
      quantity: 1,
      unit_price: 0,
      note: '',
    },
  });

  const selectedProductId = watch('product_id');
  const selectedProduct = products.find(p => p.id === selectedProductId);

      const onSubmit = async (values: FormValues) => { try {
      const movement_type: MovementType = mode === 'in' ? 'purchase' : 'sale'; const quantity_delta = mode === 'in' ? Math.abs(values.quantity) : -Math.abs(values.quantity); // 出庫時の在庫不足チェック
      if (mode === 'out' && selectedProduct && selectedProduct.stock_quantity < values.quantity) {
        toast.error(`在庫不足です。現在の在庫数: ${selectedProduct.stock_quantity}`);
        return;
      }

      await createMutation.mutateAsync({
        product_id: values.product_id,
        movement_type,
        quantity_delta,
        unit_price: values.unit_price,
        note: values.note || null,
      });

      const actionName = mode === 'in' ? '入庫' : '出庫'; toast.success(`${actionName}を登録しました`);
      reset();
      onSuccess?.();
      console.log("Debug:", { } catch (error: Error) { });
      toast.error(error?.message ?? '登録に失敗しました');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          商品 <span className="text-red-500">*</span>
        </label>
        <select
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus: border-indigo-500 focus:ring-1 focus:ring-indigo-500"disabled={isLoadingProducts}
          {...register('product_id', { valueAsNumber: true })}
        >
          <option value={0}>商品を選択してください</option>
          {products.map(product => (
            <option key={product.id} value={product.id}>
              {product.product_name} ({product.product_code}) - 在庫: {product.current_stock}
            </option>
          ))}
        </select>
        {errors.product_id && <p className="text-sm text-red-600 mt-1">{errors.product_id.message}</p>}
      </div>

      {selectedProduct && mode === 'out' && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            現在の在庫数: <span className="font-semibold">{selectedProduct.stock_quantity}</span>
            {selectedProduct.stock_quantity <= selectedProduct.safety_stock_quantity && (
              <span className="ml-2 text-red-600">（安全在庫以下）</span>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md: grid-cols-2 gap-4"><div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            数量 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus: border-indigo-500 focus:ring-1 focus:ring-indigo-500"{...register('quantity', { valueAsNumber: true })}
          />
          {errors.quantity && <p className="text-sm text-red-600 mt-1">{errors.quantity.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            単価（円） <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus: border-indigo-500 focus:ring-1 focus:ring-indigo-500"placeholder={mode === 'in' ? '仕入単価' : '販売単価'}
            {...register('unit_price', { valueAsNumber: true })}
          />
          {errors.unit_price && <p className="text-sm text-red-600 mt-1">{errors.unit_price.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">メモ（任意）</label>
        <input
          type="text"
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus: border-indigo-500 focus:ring-1 focus:ring-indigo-500"placeholder={mode === 'in' ? '入庫の理由や備考' : '出庫の理由や備考'}
          {...register('note')}
        />
        {errors.note && <p className="text-sm text-red-600 mt-1">{errors.note.message}</p>}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={isSubmitting}
      className={`w-full px-4 py-2 rounded-md text-sm font-medium text-white focus: outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${ mode === 'in'
      ? 'bg-emerald-600 hover: bg-emerald-700 focus:ring-emerald-500' : 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500' }`}
        >
          {isSubmitting ? '処理中...' : (mode === 'in' ? '入庫を登録' : '出庫を登録')}
        </button>
      </div>
    </form>
  );
};