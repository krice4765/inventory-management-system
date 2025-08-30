import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useSuppliers } from '../../hooks/useProducts';
import type { ProductWithSupplier, ProductInsert, ProductUpdate } from '../../api/products';

type FormValues = {
  product_code: string;
  name: string;
  description: string;
  purchase_price: number;
  sell_price: number;
  stock_quantity: number;
  safety_stock_quantity: number;
  main_supplier_id: number | null;
  image_url: string;
};

const schema = yup.object({
  product_code: yup.string().required('商品コードは必須です').max(50, '50文字以内で入力してください'),
  name: yup.string().required('商品名は必須です').max(100, '100文字以内で入力してください'),
  description: yup.string().max(500, '500文字以内で入力してください'),
  purchase_price: yup.number().typeError('数値を入力してください').min(0, '0以上の値を入力してください').required('仕入単価は必須です'),
  sell_price: yup.number().typeError('数値を入力してください').min(0, '0以上の値を入力してください').required('販売単価は必須です'),
  stock_quantity: yup.number().typeError('数値を入力してください').integer('整数を入力してください').min(0, '0以上の値を入力してください').required('在庫数は必須です'),
  safety_stock_quantity: yup.number().typeError('数値を入力してください').integer('整数を入力してください').min(0, '0以上の値を入力してください').required('安全在庫数は必須です'),
  main_supplier_id: yup.number().nullable(),
  image_url: yup.string().url('正しいURL形式で入力してください').max(500, '500文字以内で入力してください'),
});

export type ProductFormProps = {
  mode: 'create' | 'edit';
  initial?: ProductWithSupplier;
  onSubmit: (values: ProductInsert | ProductUpdate) => Promise<void>;
  onCancel: () => void;
};

export const ProductForm: React.FC<ProductFormProps> = ({ mode, initial, onSubmit, onCancel }) => {
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: yupResolver(schema),
    shouldFocusError: true, // バリデーションエラー時の自動フォーカス
    defaultValues: initial ? {
      product_code: initial.product_code,
      name: initial.name,
      description: initial.description || '',
      purchase_price: Number(initial.purchase_price),
      sell_price: Number(initial.sell_price),
      stock_quantity: initial.stock_quantity,
      safety_stock_quantity: initial.safety_stock_quantity,
      main_supplier_id: initial.main_supplier_id,
      image_url: initial.image_url || '',
    } : {
      product_code: '',
      name: '',
      description: '',
      purchase_price: 0,
      sell_price: 0,
      stock_quantity: 0,
      safety_stock_quantity: 0,
      main_supplier_id: null,
      image_url: '',
    },
  });

  const submitHandler = async (values: FormValues) => {
    const payload = {
      product_code: values.product_code,
      name: values.name,
      description: values.description || null,
      purchase_price: values.purchase_price,
      sell_price: values.sell_price,
      stock_quantity: values.stock_quantity,
      safety_stock_quantity: values.safety_stock_quantity,
      main_supplier_id: values.main_supplier_id || null,
      image_url: values.image_url || null,
    };
    
    await onSubmit(payload);
    if (mode === 'create') reset();
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            商品コード <span className="text-red-500">*</span>
          </label>
          <input 
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="例: P-0001"
            {...register('product_code')} 
          />
          {errors.product_code && <p className="text-sm text-red-600 mt-1">{errors.product_code.message}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            商品名 <span className="text-red-500">*</span>
          </label>
          <input 
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="商品名を入力"
            {...register('name')} 
          />
          {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            仕入単価 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">¥</span>
            <input 
              type="number" 
              step="0.01"
              min="0"
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
              {...register('purchase_price', { valueAsNumber: true })} 
            />
          </div>
          {errors.purchase_price && <p className="text-sm text-red-600 mt-1">{errors.purchase_price.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            販売単価 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">¥</span>
            <input 
              type="number" 
              step="0.01"
              min="0"
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
              {...register('sell_price', { valueAsNumber: true })} 
            />
          </div>
          {errors.sell_price && <p className="text-sm text-red-600 mt-1">{errors.sell_price.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            現在在庫数 <span className="text-red-500">*</span>
          </label>
          <input 
            type="number"
            min="0"
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="0"
            {...register('stock_quantity', { valueAsNumber: true })} 
          />
          {errors.stock_quantity && <p className="text-sm text-red-600 mt-1">{errors.stock_quantity.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            安全在庫数 <span className="text-red-500">*</span>
          </label>
          <input 
            type="number"
            min="0"
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="0"
            {...register('safety_stock_quantity', { valueAsNumber: true })} 
          />
          {errors.safety_stock_quantity && <p className="text-sm text-red-600 mt-1">{errors.safety_stock_quantity.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">メイン仕入先</label>
          <select 
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            {...register('main_supplier_id', { setValueAs: (value) => value === '' ? null : Number(value) })}
            disabled={isLoadingSuppliers}
          >
            <option value="">選択してください</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          {isLoadingSuppliers && <p className="text-sm text-gray-500 mt-1">仕入先を読み込み中...</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">商品説明</label>
        <textarea 
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          rows={3} 
          placeholder="商品の詳細説明を入力（任意）"
          {...register('description')} 
        />
        {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">商品画像URL</label>
        <input 
          type="url"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          placeholder="https://example.com/image.jpg"
          {...register('image_url')} 
        />
        {errors.image_url && <p className="text-sm text-red-600 mt-1">{errors.image_url.message}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button 
          type="button" 
          onClick={onCancel} 
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={isSubmitting}
        >
          キャンセル
        </button>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '処理中...' : (mode === 'create' ? '登録' : '更新')}
        </button>
      </div>
    </form>
  );
};