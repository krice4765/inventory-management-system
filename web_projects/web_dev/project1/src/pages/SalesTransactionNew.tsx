import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Select from 'react-select';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { salesTransactionFormSchema, SalesTransactionFormData } from '../lib/validations';
import { FormField, FormInput, FormTextarea } from '../components/FormField';

// 型定義
interface Partner {
  id: string;
  name: string;
  partner_code: string;
  partner_type: string;
  closing_day: number | null;
  payment_day: number | null;
  payment_month_offset: number | null;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  selling_price: number;
  current_stock: number;
}

interface SalesOrder {
  id: string;
  order_no: string;
  customer_id: string;
  order_date: string;
  total_amount: number;
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

const fetchSalesOrders = async (customerId: string): Promise<SalesOrder[]> => {
  if (!customerId) return [];

  const { data, error } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('customer_id', customerId)
    .in('status', ['pending', 'confirmed'])
    .order('order_date', { ascending: false });

  if (error) throw error;
  return data;
};

// 入金期日を計算する関数（フロントエンド用）
const calculatePaymentDueDate = (
  transactionDate: string,
  closingDay: number | null,
  paymentDay: number | null,
  paymentMonthOffset: number | null
): string => {
  if (!closingDay || !paymentDay || paymentMonthOffset === null) {
    // デフォルト: 月末締め翌月末払い
    const date = new Date(transactionDate);
    date.setMonth(date.getMonth() + 2);
    date.setDate(0); // 前月の最終日 = 翌月末
    return date.toISOString().split('T')[0];
  }

  const transDate = new Date(transactionDate);
  const transDay = transDate.getDate();

  // 締日を過ぎているかチェック
  const isAfterClosing = closingDay === 0
    ? false // 月末締めの場合は常にその月に含める
    : transDay > closingDay;

  // 入金月を計算
  let paymentDate = new Date(transactionDate);
  paymentDate.setMonth(paymentDate.getMonth() + paymentMonthOffset + (isAfterClosing ? 1 : 0));

  // 入金日を設定
  if (paymentDay === 0) {
    // 月末払い
    paymentDate.setMonth(paymentDate.getMonth() + 1);
    paymentDate.setDate(0); // 前月の最終日
  } else {
    paymentDate.setDate(Math.min(paymentDay, 31));
  }

  return paymentDate.toISOString().split('T')[0];
};

export default function SalesTransactionNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // マスターデータ取得
  const { data: customers, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders', selectedCustomerId],
    queryFn: () => fetchSalesOrders(selectedCustomerId),
    enabled: !!selectedCustomerId,
  });

  // React Hook Form setup
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<SalesTransactionFormData>({
    resolver: zodResolver(salesTransactionFormSchema),
    defaultValues: {
      customer_id: '',
      sales_order_id: '',
      transaction_no: '',
      transaction_date: new Date().toISOString().split('T')[0],
      payment_due_date: '',
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
  const watchCustomerId = watch('customer_id');
  const watchTransactionDate = watch('transaction_date');

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

  const salesOrderOptions = useMemo(() =>
    (salesOrders || []).map(order => ({
      value: order.id,
      label: `${order.order_no} (${new Date(order.order_date).toLocaleDateString('ja-JP')})`
    })),
    [salesOrders]
  );

  // 顧客選択時に入金期日を自動計算
  useEffect(() => {
    if (watchCustomerId && watchTransactionDate) {
      const customer = customers?.find((c) => c.id === watchCustomerId);
      if (customer) {
        const dueDate = calculatePaymentDueDate(
          watchTransactionDate,
          customer.closing_day,
          customer.payment_day,
          customer.payment_month_offset
        );
        setValue('payment_due_date', dueDate);
        setSelectedCustomerId(watchCustomerId);
      }
    }
  }, [watchCustomerId, watchTransactionDate, customers, setValue]);

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

  // 売上伝票登録mutation
  const createSalesTransactionMutation = useMutation({
    mutationFn: async (data: SalesTransactionFormData) => {
      // 1. 売上伝票ヘッダーを挿入
      const { data: transactionData, error: transactionError } = await supabase
        .from('sales_transactions')
        .insert({
          transaction_no: data.transaction_no,
          customer_id: data.customer_id,
          sales_order_id: data.sales_order_id || null,
          transaction_date: data.transaction_date,
          payment_due_date: data.payment_due_date,
          notes: data.notes || null,
          total_amount: 0, // トリガーで自動計算される
          tax_amount: 0, // トリガーで自動計算される
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // 2. 売上明細を挿入
      const itemsToInsert = data.items.map((item) => ({
        sales_transaction_id: transactionData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
      }));

      const { error: itemsError } = await supabase
        .from('sales_transaction_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return transactionData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      toast.success(`売上伝票番号 ${data.transaction_no} を登録しました`);
      navigate('/accounts-receivable');
    },
    onError: (error: any) => {
      console.error('売上伝票登録エラー:', error);
      toast.error(`登録に失敗しました: ${error.message}`);
    },
  });

  // フォーム送信
  const onSubmit = (data: SalesTransactionFormData) => {
    console.log('送信データ:', data);
    console.log('計算された合計:', { subtotal, taxAmount, total });
    createSalesTransactionMutation.mutate(data);
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

  const selectedCustomer = customers?.find((c) => c.id === watchCustomerId);
  const closingDayText = selectedCustomer
    ? `${selectedCustomer.closing_day === 0 ? '月末' : selectedCustomer.closing_day + '日'}締め${selectedCustomer.payment_month_offset === 0 ? '当月' : selectedCustomer.payment_month_offset === 1 ? '翌月' : '翌々月'}${selectedCustomer.payment_day === 0 ? '月末' : selectedCustomer.payment_day + '日'}払い`
    : '';

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/accounts-receivable')}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          売掛金管理に戻る
        </button>
        <h1 className="text-2xl font-bold text-gray-900">新規売上伝票登録</h1>
        <p className="text-sm text-gray-600 mt-1">
          売上伝票を登録すると、売掛金が自動的に生成されます
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

            {/* 受注選択（オプション） */}
            <FormField label="受注番号（任意）" error={errors.sales_order_id?.message}>
              <Controller
                name="sales_order_id"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={salesOrderOptions}
                    value={salesOrderOptions.find(option => option.value === field.value) || null}
                    onChange={(option) => field.onChange(option?.value || '')}
                    placeholder="受注を選択（任意）"
                    isClearable
                    isSearchable
                    isDisabled={!selectedCustomerId}
                    noOptionsMessage={() => '該当する受注がありません'}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
                        borderRadius: '0.5rem',
                        padding: '0.125rem',
                        boxShadow: state.isFocused ? '0 0 0 2px #3b82f6' : 'none',
                        '&:hover': {
                          borderColor: '#9ca3af'
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

            {/* 伝票番号 */}
            <FormInput
              label="伝票番号"
              required
              error={errors.transaction_no?.message}
              placeholder="例: ST-2025-001"
              {...register('transaction_no')}
            />

            {/* 取引日 */}
            <FormInput
              label="取引日"
              type="date"
              required
              error={errors.transaction_date?.message}
              {...register('transaction_date')}
            />

            {/* 入金期日 */}
            <div className="md:col-span-2">
              <FormInput
                label="入金期日"
                type="date"
                required
                error={errors.payment_due_date?.message}
                {...register('payment_due_date')}
              />
              {selectedCustomer && closingDayText && (
                <div className="mt-2 flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">締日設定: {closingDayText}</p>
                    <p className="text-xs mt-1">顧客の締日設定に基づいて自動計算されています。必要に応じて手動で変更できます。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 売上明細 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">売上明細</h2>
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
              <div
                key={field.id}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    明細 #{index + 1}
                  </span>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 商品選択 */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      商品 <span className="text-red-500">*</span>
                    </label>
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
                    {errors.items?.[index]?.product_id && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.items[index]?.product_id?.message}
                      </p>
                    )}
                  </div>

                  {/* 数量 */}
                  <div>
                    <FormInput
                      label="数量"
                      type="number"
                      required
                      min="1"
                      error={errors.items?.[index]?.quantity?.message}
                      {...register(`items.${index}.quantity`, {
                        valueAsNumber: true,
                      })}
                    />
                  </div>

                  {/* 単価 */}
                  <div>
                    <FormInput
                      label="単価"
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      error={errors.items?.[index]?.unit_price?.message}
                      {...register(`items.${index}.unit_price`, {
                        valueAsNumber: true,
                      })}
                    />
                  </div>

                  {/* 税率 */}
                  <div>
                    <FormInput
                      label="税率 (%)"
                      type="number"
                      required
                      min="0"
                      max="100"
                      error={errors.items?.[index]?.tax_rate?.message}
                      {...register(`items.${index}.tax_rate`, {
                        valueAsNumber: true,
                      })}
                    />
                  </div>

                  {/* 小計表示 */}
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600">
                      小計: ¥
                      {(
                        (watchItems[index]?.quantity || 0) *
                        (watchItems[index]?.unit_price || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 合計金額表示 */}
          <div className="mt-6 bg-gray-100 p-4 rounded-lg">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">小計:</span>
                <span className="font-medium">¥{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">消費税:</span>
                <span className="font-medium">¥{taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>合計:</span>
                <span className="text-blue-600">¥{total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 備考 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <FormTextarea
            label="備考"
            rows={3}
            error={errors.notes?.message}
            placeholder="備考を入力してください（任意）"
            {...register('notes')}
          />
        </div>

        {/* アクションボタン */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/accounts-receivable')}
              className="px-6 py-2 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  登録中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  売上伝票を登録
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
