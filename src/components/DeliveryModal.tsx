import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { useDeliveryModal } from '../stores/deliveryModal.store'
import { useOrderForDelivery } from '../hooks/useOrderForDelivery'
import { supabase } from '../lib/supabase'
import { useOrdersSync } from '../hooks/useOrdersSync'
import { processInventoryFromOrder } from '../utils/inventoryIntegration'

interface DeliveryFormData {
  amount: number
  deliveryType: 'amount_only' | 'amount_and_quantity'
  quantities?: { [productId: string]: number }
  memo?: string
}

// Yup schemaを削除し、React Hook Formのネイティブバリデーションを使用

export const DeliveryModal = () => {
  const { isOpen, selectedOrderId, close } = useDeliveryModal()
  const queryClient = useQueryClient()
  const { syncOrderData } = useOrdersSync()
  
  const { data: orderData, isLoading, isError, error } = useOrderForDelivery(selectedOrderId)
  
  const form = useForm<DeliveryFormData>({
    defaultValues: { 
      amount: 0, 
      deliveryType: 'amount_only' as const,
      quantities: {},
      memo: '' 
    },
    mode: 'onChange',
  })

  // orderDataが更新されたときにフォームのresolverを更新
  useEffect(() => {
    if (orderData) {
      console.log('📋 分納モーダル データ確認:', {
        発注額: orderData.ordered_amount,
        既納品: orderData.delivered_amount, 
        残額: orderData.remaining_amount,
        発注番号: orderData.order_no,
        商品明細: orderData.items.map(item => ({
          商品名: item.product_name,
          発注数量: item.quantity,
          分納済み: item.delivered_quantity || 0,
          残り数量: item.remaining_quantity || item.quantity
        }))
      });
      
      // フォームエラーをクリアし、バリデーションを再実行
      form.clearErrors();
      
      // 現在の値で再バリデーション実行
      const currentAmount = form.getValues('amount');
      if (currentAmount > 0) {
        form.trigger('amount');
      }
    }
  }, [orderData, form]);

  // 分納処理のMutation
  const deliveryMutation = useMutation({
    mutationFn: async (data: DeliveryFormData) => {
      if (!orderData) throw new Error('発注情報が取得できていません')
      
      // 次のシーケンス番号を取得
      const { data: seqData, error: seqError } = await supabase
        .from('transactions')
        .select('delivery_sequence')
        .eq('parent_order_id', orderData.purchase_order_id)
        .eq('transaction_type', 'purchase')
        .order('delivery_sequence', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (seqError) throw seqError
      const nextSequence = (seqData?.delivery_sequence ?? 0) + 1

      // 分納記録を挿入
      const transactionId = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          id: transactionId,
          transaction_type: 'purchase',
          status: 'confirmed',
          partner_id: orderData.partner_id,
          total_amount: data.amount,
          parent_order_id: orderData.purchase_order_id,
          delivery_sequence: nextSequence,
          transaction_date: new Date().toISOString().split('T')[0],
          memo: data.deliveryType === 'amount_and_quantity' 
            ? `分納入力 - ${orderData.order_no} (${nextSequence}回目) [個数指定]` 
            : `分納入力 - ${orderData.order_no} (${nextSequence}回目)`,
          created_at: new Date().toISOString(),
        })
      
      if (insertError) throw insertError
      
      // 🔄 分納完了時の在庫連動処理
      return { 
        deliveredAmount: data.amount, 
        memo: data.memo,
        deliveryType: data.deliveryType,
        quantities: data.quantities,
        transactionId: transactionId
      };
    },
    onSuccess: async (result) => {
      const { deliveredAmount, memo, deliveryType, quantities, transactionId } = result;
      try {
        // 🔄 在庫連動処理を実行
        if (orderData && selectedOrderId) {
          console.log('🔄 在庫連動処理開始:', {
            orderId: selectedOrderId,
            deliveredAmount,
            memo: memo || `分納入力 - ${orderData.order_no}`
          });

          const inventoryResult = await processInventoryFromOrder(
            selectedOrderId,
            deliveredAmount,
            memo || `分納入力 - ${orderData.order_no}`,
            deliveryType,
            quantities,
            transactionId
          );

          if (!inventoryResult.success) {
            console.warn('⚠️ 在庫連動処理エラー:', inventoryResult.error);
            toast.error(`分納は登録されましたが、在庫更新に失敗しました: ${inventoryResult.error}`);
          } else {
            console.log('✅ 在庫連動処理成功');
          }
        }

        // useOrdersSync が正常に動作する場合
        if (syncOrderData && typeof syncOrderData === 'function') {
          await syncOrderData('分納を登録し、在庫を更新しました');
        } else {
          // フォールバック: 従来の方法で手動同期
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['orders'] }),
            queryClient.invalidateQueries({ queryKey: ['delivery-order', selectedOrderId] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
            queryClient.invalidateQueries({ queryKey: ['delivery-progress'] }),
          ]);
          toast.success('分納を登録しました');
        }
        form.reset();
        close();
      } catch (error) {
        console.error('データ同期エラー:', error);
        // 登録は成功しているので、同期エラーでもUIは更新
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('分納を登録しました（データ同期は手動更新してください）');
        form.reset();
        close();
      }
    },
    onError: (error: Error) => {
      toast.error(`登録に失敗しました: ${error?.message ?? '不明なエラー'}`)
    }
  })

  // クイック金額設定
  const setQuickAmount = (percentage: number) => {
    if (!orderData) return
    const amount = Math.floor(orderData.remaining_amount * percentage)
    form.setValue('amount', amount, { shouldValidate: true })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">分納入力</h3>
          <button 
            onClick={close}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">発注情報を読み込み中...</p>
          </div>
        ) : isError ? (
          <div className="p-3 bg-red-50 text-red-700 rounded mb-4">
            発注情報の取得に失敗しました: {error?.message ?? '不明なエラー'}
          </div>
        ) : orderData ? (
          <form onSubmit={form.handleSubmit((data) => deliveryMutation.mutate(data))}>
            {/* 発注情報表示 */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 mb-2">
                {orderData.order_no}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-700">仕入先:</span>
                  <p className="font-medium">{orderData.partner_name}</p>
                </div>
                <div>
                  <span className="text-blue-700">発注額:</span>
                  <p className="font-medium">¥{orderData.ordered_amount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-blue-700">既納品:</span>
                  <p className="font-medium">¥{orderData.delivered_amount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-blue-700 font-semibold">残額:</span>
                  <p className="font-bold text-lg">¥{orderData.remaining_amount.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* クイック入力ボタン */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                クイック入力
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAmount(0.25)}
                  className="p-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  25%<br/>¥{Math.floor(orderData.remaining_amount * 0.25).toLocaleString()}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAmount(0.4)}
                  className="p-2 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                >
                  40%<br/>¥{Math.floor(orderData.remaining_amount * 0.4).toLocaleString()}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAmount(0.6)}
                  className="p-2 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                >
                  60%<br/>¥{Math.floor(orderData.remaining_amount * 0.6).toLocaleString()}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAmount(1.0)}
                  className="p-2 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                >
                  全額<br/>¥{orderData.remaining_amount.toLocaleString()}
                </button>
              </div>
            </div>

            {/* 納品金額入力 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                納品金額 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="1"
                {...form.register('amount', { 
                  valueAsNumber: true,
                  required: '納品金額は必須です',
                  min: { value: 1, message: '0より大きい値を入力してください' },
                  validate: (value) => {
                    if (!orderData) return true;
                    if (value > orderData.remaining_amount) {
                      return `残額¥${orderData.remaining_amount.toLocaleString()}を超えています`;
                    }
                    return true;
                  }
                })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  form.formState.errors.amount ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0"
              />
              {form.formState.errors.amount && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>

            {/* 分納タイプ選択 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分納タイプ
              </label>
              <div className="space-y-2">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    {...form.register('deliveryType')}
                    value="amount_only"
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    金額のみで分納（発注数量の100%を自動入庫）
                  </span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    {...form.register('deliveryType')}
                    value="amount_and_quantity"
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    金額＋個数を指定して分納
                  </span>
                </label>
              </div>
            </div>

            {/* 個数指定セクション */}
            {form.watch('deliveryType') === 'amount_and_quantity' && orderData.items && (
              <div className="mb-4 border border-blue-200 rounded-lg p-4 bg-blue-50">
                <h4 className="font-medium text-blue-900 mb-3">個数指定</h4>
                <div className="space-y-3">
                  {orderData.items.map((item: any) => (
                    <div key={item.product_id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 flex items-center">
                          {item.product_name}
                          {item.remaining_quantity === 0 && (
                            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                              ✅ 完了
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          <span className="font-medium">{item.product_code}</span> | 発注: <span className="font-semibold">{item.quantity}</span> | 分納済み: <span className="text-green-600 font-semibold">{item.delivered_quantity || 0}</span> | {item.remaining_quantity === 0 ? (
                            <span className="text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full text-xs">✅ 完了</span>
                          ) : (
                            <span className="text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded-full text-sm">🔢 残り: {item.remaining_quantity || item.quantity}個</span>
                          )}
                        </div>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="0"
                          max={item.remaining_quantity || item.quantity}
                          placeholder="0"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          {...form.register(`quantities.${item.product_id}`, { 
                            valueAsNumber: true,
                            min: { value: 0, message: '0以上の値を入力してください' },
                            validate: (value) => {
                              if (!value || value === 0) return true;
                              const maxQuantity = item.remaining_quantity || item.quantity;
                              if (value > maxQuantity) {
                                return `残り数量${maxQuantity}を超えています`;
                              }
                              return true;
                            }
                          })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-blue-600">
                  ※ 各商品の入庫数量を指定してください（0の場合は入庫されません）
                </div>
              </div>
            )}

            {/* 備考入力 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                備考
              </label>
              <textarea
                rows={3}
                {...form.register('memo', { 
                  maxLength: { value: 200, message: '備考は200文字以内で入力してください' } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="備考を入力..."
              />
              {form.formState.errors.memo && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.memo.message}
                </p>
              )}
            </div>

            {/* アクションボタン */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={deliveryMutation.isPending || !form.formState.isValid}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deliveryMutation.isPending ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    登録中...
                  </span>
                ) : (
                  '分納登録'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8 text-gray-500">
            発注情報が見つかりません
          </div>
        )}
      </div>
    </div>
  )
}