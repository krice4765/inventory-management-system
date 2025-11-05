import React, { useMemo } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as yup from 'yup'

import { useDeliveryModal } from '../stores/deliveryModal.store'
import { useOrderForDelivery } from '../hooks/useOrderForDelivery'
import { useOrderItemsForDelivery } from '../hooks/useOrderItemsForDelivery'
import { supabase } from '../lib/supabase'
import { useOrdersSync } from '../hooks/useOrdersSync'

interface DeliveryItemInput {
  product_id: string
  quantity: number
}

interface DeliveryFormData {
  items: DeliveryItemInput[]
  memo?: string
}

const createDeliverySchema = (maxQuantities: Record<string, number>) =>
  yup.object({
    items: yup
      .array()
      .of(
        yup.object({
          product_id: yup.string().required(),
          quantity: yup
            .number()
            .typeError('数値を入力してください')
            .min(0, '0以上の値を入力してください')
            .test('max-quantity', function (value) {
              const productId = this.parent.product_id
              const maxQty = maxQuantities[productId] || 0
              if (value && value > maxQty) {
                return this.createError({
                  message: `残数量${maxQty}を超えています`,
                })
              }
              return true
            })
            .required(),
        })
      )
      .test('at-least-one', '少なくとも1つの商品に0より大きい数量を入力してください', (items) => {
        return items?.some(item => item.quantity > 0) ?? false
      }),
    memo: yup
      .string()
      .max(200, '備考は200文字以内で入力してください')
      .optional(),
  })

export const DeliveryModal = () => {
  const { isOpen, selectedOrderId, close } = useDeliveryModal()
  const queryClient = useQueryClient()
  const { syncOrderData } = useOrdersSync()

  const { data: orderData, isLoading: orderLoading, isError: orderError, error: orderErrorMsg } = useOrderForDelivery(selectedOrderId)
  const { data: orderItems, isLoading: itemsLoading, isError: itemsError, error: itemsErrorMsg } = useOrderItemsForDelivery(selectedOrderId)

  // 残数量マップを作成
  const maxQuantities = useMemo(() => {
    if (!orderItems) return {}
    return orderItems.reduce((acc, item) => {
      acc[item.product_id] = item.remaining_quantity
      return acc
    }, {} as Record<string, number>)
  }, [orderItems])

  const form = useForm<DeliveryFormData>({
    resolver: orderItems ? yupResolver(createDeliverySchema(maxQuantities)) : undefined,
    defaultValues: {
      items: orderItems?.map(item => ({
        product_id: item.product_id,
        quantity: 0,
      })) || [],
      memo: '',
    },
    mode: 'onChange',
  })

  const { fields } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  // フォームの値が変わるたびに、orderItemsが更新されたらフィールドをリセット
  React.useEffect(() => {
    if (orderItems && orderItems.length > 0) {
      form.reset({
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: 0,
        })),
        memo: '',
      })
    }
  }, [orderItems, form])

  // フォームの値を監視
  const watchedItems = useWatch({
    control: form.control,
    name: 'items',
  })

  // 合計金額を計算
  const totalAmount = useMemo(() => {
    if (!orderItems || !watchedItems) return 0
    return watchedItems.reduce((sum, item, index) => {
      const orderItem = orderItems.find(oi => oi.product_id === item.product_id)
      if (!orderItem) return sum
      return sum + ((item.quantity || 0) * orderItem.unit_price)
    }, 0)
  }, [watchedItems, orderItems])

  // 分納処理のMutation
  const deliveryMutation = useMutation({
    mutationFn: async (data: DeliveryFormData) => {
      if (!orderData) throw new Error('発注情報が取得できていません')
      if (!orderItems) throw new Error('商品情報が取得できていません')

      // 数量が0より大きい商品のみ抽出
      const deliveryItems = data.items.filter(item => item.quantity > 0)
      if (deliveryItems.length === 0) {
        throw new Error('納品数量を入力してください')
      }

      // 合計金額を計算
      const totalAmount = deliveryItems.reduce((sum, item) => {
        const orderItem = orderItems.find(oi => oi.product_id === item.product_id)
        return sum + (item.quantity * (orderItem?.unit_price || 0))
      }, 0)

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
      const transactionId = crypto.randomUUID()
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          id: transactionId,
          transaction_type: 'purchase',
          status: 'confirmed',
          partner_id: orderData.partner_id,
          total_amount: totalAmount,
          parent_order_id: orderData.purchase_order_id,
          delivery_sequence: nextSequence,
          transaction_date: new Date().toISOString().split('T')[0],
          memo: data.memo || `納品入力 - ${orderData.order_no} (${nextSequence}回目)`,
          created_at: new Date().toISOString(),
        })

      if (insertError) throw insertError

      // 商品明細を作成
      const transactionItems = deliveryItems.map(item => {
        const orderItem = orderItems.find(oi => oi.product_id === item.product_id)
        return {
          id: crypto.randomUUID(),
          transaction_id: transactionId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: orderItem!.unit_price,
          total_amount: item.quantity * orderItem!.unit_price,
          created_at: new Date().toISOString(),
        }
      })

      // 商品明細を挿入（在庫トリガーが自動発火）
      const { error: itemsInsertError } = await supabase
        .from('transaction_items')
        .insert(transactionItems)

      if (itemsInsertError) throw itemsInsertError
    },
    onSuccess: async () => {
      try {
        // useOrdersSync が正常に動作する場合
        if (syncOrderData && typeof syncOrderData === 'function') {
          await syncOrderData('納品を登録しました');
        } else {
          // フォールバック: 従来の方法で手動同期
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['orders'] }),
            queryClient.invalidateQueries({ queryKey: ['delivery-order', selectedOrderId] }),
            queryClient.invalidateQueries({ queryKey: ['delivery-order-items', selectedOrderId] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
            queryClient.invalidateQueries({ queryKey: ['delivery-progress'] }),
          ]);
          toast.success('納品を登録しました');
        }
        form.reset();
        close();
      } catch (error) {
        console.error('データ同期エラー:', error);
        // 登録は成功しているので、同期エラーでもUIは更新
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success('納品を登録しました（データ同期は手動更新してください）');
        form.reset();
        close();
      }
    },
    onError: (error: any) => {
      toast.error(`登録に失敗しました: ${error?.message ?? '不明なエラー'}`)
    }
  })

  // 全数入力（残数量を全て入力）
  const setAllRemaining = () => {
    if (!orderItems) return
    orderItems.forEach((item, index) => {
      form.setValue(`items.${index}.quantity`, item.remaining_quantity, { shouldValidate: true })
    })
  }

  // クリア（全て0に）
  const clearAll = () => {
    if (!orderItems) return
    orderItems.forEach((item, index) => {
      form.setValue(`items.${index}.quantity`, 0, { shouldValidate: true })
    })
  }

  if (!isOpen) return null

  const isLoading = orderLoading || itemsLoading
  const isError = orderError || itemsError
  const errorMessage = orderErrorMsg?.message || itemsErrorMsg?.message

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">納品入力（個数指定）</h3>
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
            発注情報の取得に失敗しました: {errorMessage ?? '不明なエラー'}
          </div>
        ) : orderData && orderItems ? (
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

            {/* クイックアクションボタン */}
            <div className="flex justify-end space-x-2 mb-4">
              <button
                type="button"
                onClick={clearAll}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                クリア
              </button>
              <button
                type="button"
                onClick={setAllRemaining}
                className="px-3 py-1.5 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
              >
                全数入力
              </button>
            </div>

            {/* 商品リスト */}
            <div className="mb-6">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">商品</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">発注数</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">既納品</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">残数</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">納品数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orderItems.map((item, index) => {
                      const fieldError = form.formState.errors.items?.[index]?.quantity
                      return (
                        <tr key={item.product_id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.product_code}</div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {item.ordered_quantity}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {item.delivered_quantity}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">
                            {item.remaining_quantity}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={item.remaining_quantity}
                              {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                              className={`w-20 px-2 py-1 text-right border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                fieldError ? 'border-red-300' : 'border-gray-300'
                              }`}
                              disabled={item.remaining_quantity === 0}
                            />
                            {fieldError && (
                              <div className="text-xs text-red-600 mt-1">
                                {fieldError.message}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {form.formState.errors.items && typeof form.formState.errors.items === 'object' && 'message' in form.formState.errors.items && (
                <p className="mt-2 text-sm text-red-600">
                  {form.formState.errors.items.message}
                </p>
              )}
            </div>

            {/* 合計金額表示 */}
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-green-700 font-semibold">納品合計金額:</span>
                <span className="text-2xl font-bold text-green-900">
                  ¥{totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* 備考入力 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                備考
              </label>
              <textarea
                rows={3}
                {...form.register('memo')}
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
                  '納品登録'
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
