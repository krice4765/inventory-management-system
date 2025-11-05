import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, ArrowLeft, FileText, Lock, Unlock, DollarSign } from 'lucide-react';
import Select from 'react-select';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Partner, Product, UserRole } from '../types';
import { roleDisplayNames } from '../types';
import { orderFormSchema, OrderFormData } from '../lib/validations';
import { FormField, FormInput } from '../components/FormField';
import DrawingInfoSection from '../components/DrawingInfoSection';

export default function OrderNew() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // React Hook Form setup
  const {
    register,
    control,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      partner_id: '',
      assigned_user_id: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_deadline: '',
      memo: '',
      notes: '',
      shipping_cost: 0,
      shipping_tax_rate: 0.1,
      items: [
        {
          product_id: '',
          quantity: 1,
          unit_price: 0,
          total_amount: 0,
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // UI state for lock buttons (not part of form data)
  const [itemLocks, setItemLocks] = useState<Array<{ quantity_locked: boolean; unit_price_locked: boolean }>>([
    { quantity_locked: false, unit_price_locked: false }
  ]);

  // Phase F2: カスタム図面情報（発注ごと）
  const [customDrawingInfo, setCustomDrawingInfo] = useState({
    custom_drawing_number: null as string | null,
    custom_drawing_revision: null as string | null,
    custom_drawing_name: null as string | null,
    custom_drawing_notes: null as string | null,
    custom_drawing_file_path: null as string | null,
    custom_drawing_file_name: null as string | null,
  });

  // 標準図面情報のプリフィル済みフラグ
  const [drawingPrefilled, setDrawingPrefilled] = useState(false);

  const toggleQuantityLock = (index: number) => {
    setItemLocks(prev => prev.map((lock, i) =>
      i === index
        ? { ...lock, quantity_locked: !lock.quantity_locked }
        : lock
    ));
  };

  const toggleUnitPriceLock = (index: number) => {
    setItemLocks(prev => prev.map((lock, i) =>
      i === index
        ? { ...lock, unit_price_locked: !lock.unit_price_locked }
        : lock
    ));
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  // ユーザーデータがロードされたらデフォルト値を設定
  useEffect(() => {
    console.log('[OrderNew] useEffect triggered - users.length:', users.length, 'user?.id:', user?.id);
    if (users.length > 0) {
      const currentValue = watch('assigned_user_id');
      console.log('[OrderNew] Current assigned_user_id value:', currentValue);
      // 値が空の場合のみデフォルト値を設定
      if (!currentValue) {
        // 業務担当者のみのリストなので、ログインユーザーがリストにあれば優先、なければ最初のユーザー
        const userInList = users.find((u: any) => u.id === user?.id);
        const defaultUserId = userInList ? user.id : users[0]?.id;

        if (defaultUserId) {
          console.log('[OrderNew] Setting default assigned_user_id to:', defaultUserId);
          setValue('assigned_user_id', defaultUserId);
          setSelectedUserId(defaultUserId);
        }
      } else {
        console.log('[OrderNew] assigned_user_id already has value, skipping default');
      }
    }
  }, [users, user?.id, setValue, watch]);

  const fetchMasterData = async () => {
    console.log('[OrderNew] fetchMasterData started, user:', user?.id || 'No user');
    try {
      console.log('[OrderNew] Fetching partners, products, and users...');

      // タイムアウト付きクエリ
      const dataPromise = Promise.all([
        supabase
          .from('partners')
          .select('*')
          .eq('is_active', true)
          .in('partner_type', ['supplier', 'both'])
          .order('name'),

        supabase
          .from('products')
          .select('*')
          .order('product_name')
      ]);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      );

      const [partnersResult, productsResult] = await Promise.race([dataPromise, timeoutPromise]);

      console.log('[OrderNew] Partners result:', partnersResult.data?.length || 0, 'items');
      console.log('[OrderNew] Products result:', productsResult.data?.length || 0, 'items');

      if (partnersResult.error) throw partnersResult.error;
      if (productsResult.error) throw productsResult.error;

      setPartners(partnersResult.data || []);
      setProducts(productsResult.data || []);

      // ユーザー一覧を取得（Edge Function経由）
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        try {
          console.log('[OrderNew] Fetching users from Edge Function...');
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users`,
            {
              headers: {
                'Authorization': `Bearer ${sessionData.session.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          console.log('[OrderNew] Edge Function response status:', response.status);

          if (response.ok) {
            const result = await response.json();
            const usersData = result.users.map((u: any) => ({
              id: u.id,
              full_name: u.user_metadata?.full_name || u.email,
              email: u.email,
              role: u.user_metadata?.role || 'staff',
            }));
            console.log('[OrderNew] Raw users data:', usersData);
            setUsers(usersData);
            console.log('[OrderNew] Users loaded:', usersData.length, 'items');
          } else {
            const errorText = await response.text();
            console.error('[OrderNew] Edge Function error:', response.status, errorText);
            toast.error('ユーザー一覧の取得に失敗しました');
          }
        } catch (error) {
          console.error('[OrderNew] Edge Function fetch error:', error);
          toast.error('ユーザー一覧の取得に失敗しました');
        }
      }

      console.log('[OrderNew] Master data loaded successfully');
    } catch (error) {
      console.error('[OrderNew] Master data fetch error:', error);
      console.error('[OrderNew] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error('マスターデータの取得に失敗しました。ページをリロードしてください。');
    } finally {
      console.log('[OrderNew] Setting loading to false');
      setLoading(false);
    }
  };

  // react-select用のオプションをメモ化
  const partnerOptions = useMemo(() =>
    partners.map(partner => ({
      value: partner.id,
      label: `${partner.name} (${partner.partner_code})`
    })),
    [partners]
  );

  const productOptions = useMemo(() =>
    products.map(product => ({
      value: product.id,
      label: `${product.product_name} (${product.product_code})`
    })),
    [products]
  );

  // 担当者オプションをメモ化（業務担当者のみ）
  const userOptions = useMemo(() => {
    // Edge Functionで既にフィルタリング済み（manager, purchasing_staff, inventory_staff）
    return users
      .map((u: any) => {
        const userName = u.full_name || u.email || '不明';
        const roleLabel = roleDisplayNames[u.role as UserRole] || roleDisplayNames.staff;
        return {
          value: u.id,
          label: `${userName} (${roleLabel})`,
          role: u.role,
        };
      })
      .sort((a, b) => {
        const roleOrder: Record<string, number> = {
          'manager': 1,
          'purchasing_staff': 2,
          'inventory_staff': 3,
        };
        return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
      });
  }, [users]);

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    const purchasePrice = Number(product?.standard_cost ?? 0);

    // Phase F2: 最初の商品選択時に標準図面情報を自動プリフィル
    if (!drawingPrefilled && product && productId) {
      if (product.drawing_number || product.drawing_revision || product.drawing_name) {
        setCustomDrawingInfo({
          custom_drawing_number: product.drawing_number || null,
          custom_drawing_revision: product.drawing_revision || null,
          custom_drawing_name: product.drawing_name || null,
          custom_drawing_notes: product.drawing_notes || null,
          custom_drawing_file_path: null, // ファイルはコピーしない
          custom_drawing_file_name: null,
        });
        setDrawingPrefilled(true);
        toast.success('標準図面情報をプリフィルしました');
      }
    }

    const currentItem = watch(`items.${index}`);
    const locks = itemLocks[index];

    const nextUnitPrice = locks?.unit_price_locked ? currentItem.unit_price : purchasePrice;
    const nextQuantity = locks?.quantity_locked ? currentItem.quantity : (isNaN(currentItem.quantity) ? 1 : Math.max(1, Math.floor(currentItem.quantity)));
    const nextTotal = (isNaN(nextQuantity) ? 0 : nextQuantity) * (isNaN(nextUnitPrice) ? 0 : nextUnitPrice);

    setValue(`items.${index}`, {
      product_id: productId,
      unit_price: nextUnitPrice,
      quantity: nextQuantity,
      total_amount: nextTotal,
    });
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const currentItem = watch(`items.${index}`);
    const safeQuantity = isNaN(quantity) ? 0 : quantity;
    const safeUnitPrice = isNaN(currentItem.unit_price) ? 0 : currentItem.unit_price;
    const total = safeQuantity * safeUnitPrice;
    setValue(`items.${index}`, {
      ...currentItem,
      quantity: safeQuantity,
      total_amount: total,
    });
  };

  const handleUnitPriceChange = (index: number, unitPrice: number) => {
    const currentItem = watch(`items.${index}`);
    const safeUnitPrice = isNaN(unitPrice) ? 0 : unitPrice;
    const safeQuantity = isNaN(currentItem.quantity) ? 0 : currentItem.quantity;
    const total = safeQuantity * safeUnitPrice;
    setValue(`items.${index}`, {
      ...currentItem,
      unit_price: safeUnitPrice,
      total_amount: total,
    });
  };

  const addItem = () => {
    append({
      product_id: '',
      quantity: 1,
      unit_price: 0,
      total_amount: 0,
    });
    setItemLocks([...itemLocks, { quantity_locked: false, unit_price_locked: false }]);
  };

  const removeItem = (index: number) => {
    if (fields.length === 1) {
      toast.error('明細行は最低1行必要です');
      return;
    }
    remove(index);
    setItemLocks(itemLocks.filter((_, i) => i !== index));
  };

  const items = watch('items');
  const shipping_cost = watch('shipping_cost') || 0;
  const shipping_tax_rate = watch('shipping_tax_rate') || 0.1;

  const getTotalAmount = () => {
    return items.reduce((sum, item) => {
      const amount = isNaN(item.total_amount) ? 0 : item.total_amount;
      return sum + amount;
    }, 0);
  };

  const getTaxDetails = () => {
    // 商品を税率ごとに分ける
    let total_10 = 0;  // 10%対象商品の小計
    let total_8 = 0;   // 8%対象商品の小計

    items.forEach(item => {
      const amount = isNaN(item.total_amount) ? 0 : item.total_amount;
      const product = products.find(p => p.id === item.product_id);
      const taxCategory = product?.tax_category || 'standard_10';

      if (taxCategory === 'reduced_8') {
        total_8 += amount;
      } else {
        total_10 += amount;
      }
    });

    const tax_10 = Math.floor(total_10 * 0.1);
    const tax_8 = Math.floor(total_8 * 0.08);
    const shipping_tax = Math.floor(shipping_cost * shipping_tax_rate);

    return {
      total_10,
      total_8,
      tax_10,
      tax_8,
      shipping_cost,
      shipping_tax,
      total_tax: tax_10 + tax_8 + shipping_tax
    };
  };

  const getTaxAmount = () => {
    return getTaxDetails().total_tax;
  };

  const getGrandTotal = () => {
    const details = getTaxDetails();
    return getTotalAmount() + details.shipping_cost + details.total_tax;
  };

  const handleSubmit = async (formData: OrderFormData) => {
    try {
      const { data: orderNo, error: rpcError } = await supabase.rpc('generate_order_no');
      if (rpcError) throw rpcError;

      const grandTotal = getGrandTotal();

      // Phase F2: カスタム図面情報を含める
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert([{
          order_no: orderNo,
          partner_id: formData.partner_id,
          order_date: formData.order_date,
          delivery_deadline: formData.delivery_deadline || null,
          total_amount: grandTotal,
          status: 'active',
          memo: formData.memo,
          notes: formData.notes,
          created_by_user_id: selectedUserId || user?.id || null,
          shipping_cost: formData.shipping_cost || 0,
          shipping_tax_rate: formData.shipping_tax_rate || 0.1,
          custom_drawing_number: customDrawingInfo.custom_drawing_number,
          custom_drawing_revision: customDrawingInfo.custom_drawing_revision,
          custom_drawing_name: customDrawingInfo.custom_drawing_name,
          custom_drawing_notes: customDrawingInfo.custom_drawing_notes,
          custom_drawing_file_path: customDrawingInfo.custom_drawing_file_path,
          custom_drawing_file_name: customDrawingInfo.custom_drawing_file_name,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = formData.items.map(item => ({
        purchase_order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.total_amount,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success(`発注書「${orderNo}」を作成しました`);
      navigate('/orders');
    } catch (error) {
      console.error('Purchase order creation error:', error);
      toast.error('発注書の作成に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            発注管理に戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">新規発注書作成</h1>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">発注書情報</h2>
          </div>
        </div>

        <form onSubmit={handleFormSubmit(handleSubmit)} className="p-6 space-y-6">
          {/* ヘッダー情報 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="仕入先" required error={errors.partner_id}>
              <Controller
                name="partner_id"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={partnerOptions}
                    value={partnerOptions.find(option => option.value === field.value) || null}
                    onChange={(option) => field.onChange(option?.value || '')}
                    placeholder="仕入先を検索または選択..."
                    isClearable
                    isSearchable
                    noOptionsMessage={() => '該当する仕入先がありません'}
                    className={errors.partner_id ? 'react-select-error' : ''}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: errors.partner_id ? '#fca5a5' : state.isFocused ? '#3b82f6' : '#d1d5db',
                        borderRadius: '0.75rem',
                        padding: '0.5rem',
                        boxShadow: state.isFocused ? (errors.partner_id ? '0 0 0 2px #ef4444' : '0 0 0 2px #3b82f6') : 'none',
                        '&:hover': {
                          borderColor: errors.partner_id ? '#f87171' : '#9ca3af'
                        }
                      }),
                      menu: (base) => ({
                        ...base,
                        borderRadius: '0.75rem',
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

            <FormField label="発注日" required error={errors.order_date}>
              <FormInput
                type="date"
                error={errors.order_date}
                {...register('order_date')}
              />
            </FormField>

            <FormField label="発注担当者" required error={errors.assigned_user_id}>
              <Controller
                name="assigned_user_id"
                control={control}
                render={({ field }) => {
                  const selectedOption = userOptions.find(opt => opt.value === field.value);
                  console.log('[OrderNew] Controller render - field.value:', field.value, 'userOptions:', userOptions, 'selectedOption:', selectedOption);
                  return (
                    <Select
                      options={userOptions}
                      value={selectedOption || null}
                      onChange={(option) => {
                        field.onChange(option?.value || '');
                        setSelectedUserId(option?.value || '');
                      }}
                      placeholder="担当者を選択..."
                      isClearable
                      isSearchable
                      noOptionsMessage={() => '該当する担当者がありません'}
                      className={errors.assigned_user_id ? 'react-select-error' : ''}
                      key={users.length > 0 ? 'users-loaded' : 'users-empty'}
                      styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: errors.assigned_user_id ? '#fca5a5' : state.isFocused ? '#3b82f6' : '#d1d5db',
                        borderRadius: '0.75rem',
                        padding: '0.5rem',
                        boxShadow: state.isFocused ? (errors.assigned_user_id ? '0 0 0 2px #ef4444' : '0 0 0 2px #3b82f6') : 'none',
                        '&:hover': {
                          borderColor: errors.assigned_user_id ? '#f87171' : '#9ca3af'
                        }
                      }),
                      menu: (base) => ({
                        ...base,
                        borderRadius: '0.75rem',
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
                  );
                }}
              />
            </FormField>

            <FormField label="希望納期" error={errors.delivery_deadline}>
              <FormInput
                type="date"
                error={errors.delivery_deadline}
                {...register('delivery_deadline')}
              />
            </FormField>

            <FormField label="備考" error={errors.memo}>
              <FormInput
                type="text"
                error={errors.memo}
                placeholder="備考を入力"
                {...register('memo')}
              />
            </FormField>

            <FormField label="発注書備考（PDF表示用）" error={errors.notes}>
              <textarea
                className={`block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ${
                  errors.notes ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-300 focus:ring-blue-600'
                } focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
                rows={3}
                placeholder="発注書のPDFに表示される備考を入力"
                {...register('notes')}
              />
              {errors.notes && (
                <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
              )}
            </FormField>
          </div>

          {/* Phase F2: カスタム図面情報セクション */}
          <div className="mt-6">
            <DrawingInfoSection
              drawingInfo={customDrawingInfo}
              onDrawingInfoChange={setCustomDrawingInfo}
              targetId={undefined} // 発注書作成前はIDがないため未設定
              uploadType="purchase_order"
              title="カスタム図面情報（この発注専用）"
            />
            <p className="mt-2 text-sm text-gray-500">
              ※ 商品マスターの標準図面情報が自動プリフィルされます。必要に応じて編集してください。
            </p>
            <p className="mt-1 text-sm text-gray-500">
              ※ PDFファイルは発注書作成後にアップロードできます。
            </p>
          </div>

          {/* 明細行 */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">明細</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                行追加
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      商品
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      数量
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      単価
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      小計
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {fields.map((field, index) => {
                    const currentItem = watch(`items.${index}`);
                    const locks = itemLocks[index] || { quantity_locked: false, unit_price_locked: false };

                    return (
                      <tr key={field.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3">
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
                                menuPortalTarget={document.body}
                                styles={{
                                  control: (base, state) => ({
                                    ...base,
                                    minHeight: '32px',
                                    height: '32px',
                                    borderColor: errors.items?.[index]?.product_id ? '#fca5a5' : state.isFocused ? '#3b82f6' : '#d1d5db',
                                    fontSize: '0.875rem',
                                    boxShadow: 'none',
                                    '&:hover': {
                                      borderColor: errors.items?.[index]?.product_id ? '#f87171' : '#9ca3af'
                                    }
                                  }),
                                  valueContainer: (base) => ({
                                    ...base,
                                    height: '32px',
                                    padding: '0 6px'
                                  }),
                                  input: (base) => ({
                                    ...base,
                                    margin: '0',
                                    padding: '0'
                                  }),
                                  indicatorsContainer: (base) => ({
                                    ...base,
                                    height: '32px'
                                  }),
                                  menuPortal: (base) => ({
                                    ...base,
                                    zIndex: 9999
                                  }),
                                  menu: (base) => ({
                                    ...base,
                                    fontSize: '0.875rem'
                                  }),
                                  option: (base, state) => ({
                                    ...base,
                                    backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#dbeafe' : 'white',
                                    color: state.isSelected ? 'white' : '#1f2937',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem'
                                  })
                                }}
                              />
                            )}
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              className={`flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                                locks.quantity_locked
                                  ? 'bg-yellow-50 border-yellow-300'
                                  : errors.items?.[index]?.quantity ? 'border-red-300' : 'border-gray-300'
                              }`}
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                              onChange={(e) => {
                                const value = e.target.value;
                                const numValue = parseInt(value, 10);
                                handleQuantityChange(index, numValue);
                              }}
                              onBlur={(e) => {
                                const value = parseInt(e.target.value, 10);
                                const validatedQuantity = Math.max(1, isNaN(value) ? 1 : Math.floor(value));
                                if (validatedQuantity !== currentItem.quantity) {
                                  handleQuantityChange(index, validatedQuantity);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => toggleQuantityLock(index)}
                              className={`p-1 rounded text-xs transition-colors ${
                                locks.quantity_locked
                                  ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                              title={locks.quantity_locked ? '数量固定を解除' : '数量を固定'}
                            >
                              {locks.quantity_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className={`flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                                locks.unit_price_locked
                                  ? 'bg-orange-50 border-orange-300'
                                  : errors.items?.[index]?.unit_price ? 'border-red-300' : 'border-gray-300'
                              }`}
                              {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                              onChange={(e) => {
                                const value = e.target.value;
                                const numValue = parseFloat(value);
                                handleUnitPriceChange(index, numValue);
                              }}
                              onBlur={(e) => {
                                const value = parseFloat(e.target.value);
                                const validatedPrice = Math.max(0, isNaN(value) ? 0 : value);
                                if (validatedPrice !== currentItem.unit_price) {
                                  handleUnitPriceChange(index, validatedPrice);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => toggleUnitPriceLock(index)}
                              className={`p-1 rounded text-xs transition-colors ${
                                locks.unit_price_locked
                                  ? 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                              title={locks.unit_price_locked ? '単価固定を解除' : '単価を固定'}
                            >
                              {locks.unit_price_locked ? <Lock className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-sm font-medium">
                          ¥{(isNaN(currentItem.total_amount) ? 0 : currentItem.total_amount).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="行削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 送料入力 */}
            <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                送料設定
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FormField label="送料" error={errors.shipping_cost?.message}>
                    <FormInput
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      {...register('shipping_cost', { valueAsNumber: true })}
                      error={errors.shipping_cost?.message}
                    />
                  </FormField>
                </div>
                <div>
                  <FormField label="送料消費税率" error={errors.shipping_tax_rate?.message}>
                    <select
                      {...register('shipping_tax_rate', { valueAsNumber: true })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value={0.1}>10%</option>
                      <option value={0.08}>8%</option>
                    </select>
                  </FormField>
                </div>
              </div>
            </div>

            {/* 合計計算 */}
            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <div className="text-right space-y-2">
                <div className="flex justify-between text-sm">
                  <span>商品小計:</span>
                  <span>¥{getTotalAmount().toLocaleString()}</span>
                </div>

                {(() => {
                  const details = getTaxDetails();
                  return (
                    <>
                      {details.total_10 > 0 && (
                        <div className="flex justify-between text-xs text-gray-600 pl-4">
                          <span>　└ 標準税率10%対象: ¥{details.total_10.toLocaleString()}</span>
                          <span>消費税: ¥{details.tax_10.toLocaleString()}</span>
                        </div>
                      )}
                      {details.total_8 > 0 && (
                        <div className="flex justify-between text-xs text-gray-600 pl-4">
                          <span>　└ 軽減税率8%対象: ¥{details.total_8.toLocaleString()}</span>
                          <span>消費税: ¥{details.tax_8.toLocaleString()}</span>
                        </div>
                      )}
                      {details.shipping_cost > 0 && (
                        <>
                          <div className="flex justify-between text-sm mt-2">
                            <span>送料:</span>
                            <span>¥{details.shipping_cost.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-600 pl-4">
                            <span>　└ 送料消費税:</span>
                            <span>¥{details.shipping_tax.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-sm font-medium border-t pt-2 mt-2">
                        <span>消費税合計:</span>
                        <span>¥{details.total_tax.toLocaleString()}</span>
                      </div>
                    </>
                  );
                })()}

                <div className="flex justify-between text-lg font-bold border-t-2 border-gray-400 pt-2 mt-2">
                  <span>総合計:</span>
                  <span>¥{getGrandTotal().toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 送信ボタン */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  作成中...
                </span>
              ) : (
                '発注書作成'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
