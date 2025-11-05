import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Select from 'react-select';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { salesOrderFormSchema, SalesOrderFormData } from '../lib/validations';
import { FormField, FormInput, FormTextarea } from '../components/FormField';

// 型定義
interface Partner {
  id: string;
  name: string;
  partner_code: string;
  partner_type: string;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  selling_price: number;
  current_stock: number;
  reserved_stock: number;
}

// データ取得関数
const fetchCustomers = async (): Promise<Partner[]> => {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .in('partner_type', ['customer', 'both'])
    .order('name');

  if (error) throw error;
  return data;
};

const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('product_name');

  if (error) throw error;
  return data;
};

export default function SalesOrderNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // マスターデータ取得
  const { data: customers, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  // React Hook Form setup
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<SalesOrderFormData>({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues: {
      customer_id: '',
      order_no: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: '',
      delivery_address: '',
      notes: '',
      items: [
        {
          product_id: '',
          quantity: 1,
          unit_price: 0,
          tax_rate: 10,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');

  // react-select用のオプションをメモ化
  const customerOptions = useMemo(() =>
    (customers || []).map(customer => ({
      value: customer.id,
      label: `${customer.name} (${customer.partner_code})`
    })),
    [customers]
  );

  const productOptions = useMemo(() =>
    (products || []).map(product => ({
      value: product.id,
      label: `${product.product_name} (${product.product_code})`
    })),
    [products]
  );

  // 合計金額計算
  const calculateTotals = () => {
    const subtotal = watchItems.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unit_price || 0);
      return sum + itemSubtotal;
    }, 0);

    const taxAmount = watchItems.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unit_price || 0);
      const itemTax = Math.round((itemSubtotal * (item.tax_rate || 0)) / 100);
      return sum + itemTax;
    }, 0);

    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  // 商品選択時の処理（販売価格を自動セット）
  const handleProductChange = (index: number, productId: string) => {
    const selectedProduct = products?.find((p) => p.id === productId);
    if (selectedProduct) {
      setValue(`items.${index}.unit_price`, selectedProduct.selling_price);
    }
  };

  // 受注登録mutation
  const createSalesOrderMutation = useMutation({
    mutationFn: async (data: SalesOrderFormData) => {
      // 1. 受注ヘッダーを挿入
      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          order_no: data.order_no,
          customer_id: data.customer_id,
          order_date: data.order_date,
          delivery_date: data.delivery_date || null,
          delivery_address: data.delivery_address || null,
          notes: data.notes || null,
          status: 'pending', // 初期状態は「受注確認待ち」
          total_amount: 0, // トリガーで自動計算される
          tax_amount: 0, // トリガーで自動計算される
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. 受注明細を挿入
      const itemsToInsert = data.items.map((item) => ({
        sales_order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return orderData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success(`受注番号 ${data.order_no} を登録しました`);
      navigate('/sales-orders');
    },
    onError: (error: any) => {
      console.error('受注登録エラー:', error);
      toast.error(`登録に失敗しました: ${error.message}`);
    },
  });

  // フォーム送信
  const onSubmit = (data: SalesOrderFormData) => {
    console.log('送信データ:', data);
    console.log('計算された合計:', { subtotal, taxAmount, total });
    createSalesOrderMutation.mutate(data);
  };

  if (isLoadingCustomers || isLoadingProducts) {
    return (
      <div className="p-6">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
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
        <h1 className="text-2xl font-bold text-gray-900">新規受注登録</h1>
        <p className="text-sm text-gray-600 mt-1">
          新しい受注を登録します
        </p>
      </div>

      {/* フォーム */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本情報 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 顧客選択 */}
            <FormField label="顧客" required error={errors.customer_id?.message}>
              <Controller
                name="customer_id"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={customerOptions}
                    value={customerOptions.find(option => option.value === field.value) || null}
                    onChange={(option) => field.onChange(option?.value || '')}
                    placeholder="顧客を検索または選択..."
                    isClearable
                    isSearchable
                    noOptionsMessage={() => '該当する顧客がありません'}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: errors.customer_id ? '#fca5a5' : state.isFocused ? '#3b82f6' : '#d1d5db',
                        borderRadius: '0.5rem',
                        padding: '0.125rem',
                        boxShadow: state.isFocused ? (errors.customer_id ? '0 0 0 2px #ef4444' : '0 0 0 2px #3b82f6') : 'none',
                        '&:hover': {
                          borderColor: errors.customer_id ? '#f87171' : '#9ca3af'
                        }
                      }),
                      menu: (base) => ({
                        ...base,
                        borderRadius: '0.5rem',
                        marginTop: '0.25rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#dbeafe' : 'white',
                        color: state.isSelected ? 'white' : '#1f2937',
                        cursor: 'pointer'
                      })
                    }}
                  />
                )}
              />
            </FormField>

            {/* 受注番号 */}
            <FormInput
              label="受注番号"
              required
              error={errors.order_no?.message}
              placeholder="例: SO-2025-001"
              {...register('order_no')}
            />

            {/* 受注日 */}
            <FormInput
              label="受注日"
              type="date"
              required
              error={errors.order_date?.message}
              {...register('order_date')}
            />

            {/* 納期 */}
            <FormInput
              label="納期"
              type="date"
              error={errors.delivery_date?.message}
              {...register('delivery_date')}
            />
          </div>

          {/* 納品先住所 */}
          <div className="mt-4">
            <FormTextarea
              label="納品先住所"
              rows={3}
              error={errors.delivery_address?.message}
              placeholder="納品先住所を入力してください（任意）"
              {...register('delivery_address')}
            />
          </div>
        </div>

        {/* 受注明細 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">受注明細</h2>
            <button
              type="button"
              onClick={() =>
                append({
                  product_id: '',
                  quantity: 1,
                  unit_price: 0,
                  tax_rate: 10,
                })
              }
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
            >
              <Plus className="h-4 w-4" />
              明細追加
            </button>
          </div>

          {errors.items?.message && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {errors.items.message}
            </div>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    明細 {index + 1}
                  </h3>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* 商品選択 */}
                  <div className="md:col-span-2">
                    <FormField
                      label="商品"
                      required
                      error={errors.items?.[index]?.product_id?.message}
                    >
                      <Controller
                        name={`items.${index}.product_id`}
                        control={control}
                        render={({ field: productField }) => (
                          <Select
                            {...productField}
                            options={productOptions}
                            value={productOptions.find(option => option.value === productField.value) || null}
                            onChange={(option) => {
                              productField.onChange(option?.value || '');
                              handleProductChange(index, option?.value || '');
                            }}
                            placeholder="商品を検索..."
                            isClearable
                            isSearchable
                            noOptionsMessage={() => '該当する商品がありません'}
                            styles={{
                              control: (base, state) => ({
                                ...base,
                                borderColor: errors.items?.[index]?.product_id ? '#fca5a5' : state.isFocused ? '#3b82f6' : '#d1d5db',
                                borderRadius: '0.5rem',
                                boxShadow: state.isFocused ? (errors.items?.[index]?.product_id ? '0 0 0 2px #ef4444' : '0 0 0 2px #3b82f6') : 'none',
                                '&:hover': {
                                  borderColor: errors.items?.[index]?.product_id ? '#f87171' : '#9ca3af'
                                }
                              }),
                              menu: (base) => ({
                                ...base,
                                borderRadius: '0.5rem',
                                marginTop: '0.25rem',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                              }),
                              option: (base, state) => ({
                                ...base,
                                backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#dbeafe' : 'white',
                                color: state.isSelected ? 'white' : '#1f2937',
                                cursor: 'pointer'
                              })
                            }}
                          />
                        )}
                      />
                    </FormField>
                  </div>

                  {/* 数量 */}
                  <FormInput
                    label="数量"
                    type="number"
                    min={1}
                    required
                    error={errors.items?.[index]?.quantity?.message}
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />

                  {/* 単価 */}
                  <FormInput
                    label="単価"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    error={errors.items?.[index]?.unit_price?.message}
                    {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                  />

                  {/* 税率 */}
                  <FormInput
                    label="税率 (%)"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    error={errors.items?.[index]?.tax_rate?.message}
                    {...register(`items.${index}.tax_rate`, { valueAsNumber: true })}
                  />

                  {/* 明細小計表示 */}
                  <div className="md:col-span-4 bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">小計:</span>
                      <span className="font-medium">
                        ¥
                        {(
                          (watchItems[index]?.quantity || 0) *
                          (watchItems[index]?.unit_price || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">税額:</span>
                      <span className="font-medium">
                        ¥
                        {Math.round(
                          ((watchItems[index]?.quantity || 0) *
                            (watchItems[index]?.unit_price || 0) *
                            (watchItems[index]?.tax_rate || 0)) /
                            100
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-200">
                      <span className="text-gray-900 font-semibold">明細合計:</span>
                      <span className="font-semibold text-blue-600">
                        ¥
                        {(
                          (watchItems[index]?.quantity || 0) *
                            (watchItems[index]?.unit_price || 0) +
                          Math.round(
                            ((watchItems[index]?.quantity || 0) *
                              (watchItems[index]?.unit_price || 0) *
                              (watchItems[index]?.tax_rate || 0)) /
                              100
                          )
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 合計金額表示 */}
          <div className="mt-6 bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-700">小計:</span>
              <span className="text-lg font-medium">¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-700">消費税:</span>
              <span className="text-lg font-medium">¥{taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t-2 border-blue-200">
              <span className="text-lg font-bold text-gray-900">合計金額（税込）:</span>
              <span className="text-2xl font-bold text-blue-600">
                ¥{total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 備考 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <FormTextarea
            label="備考"
            rows={4}
            error={errors.notes?.message}
            placeholder="備考を入力してください（任意）"
            {...register('notes')}
          />
        </div>

        {/* 送信ボタン */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/sales-orders')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            <Save className="h-5 w-5" />
            {isSubmitting ? '登録中...' : '受注登録'}
          </button>
        </div>
      </form>
    </div>
  );
}
