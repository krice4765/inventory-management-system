import React from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as yup from 'yup'

import { useDeliveryModal } from '../stores/deliveryModal.store'
import { useOrderForDelivery } from '../hooks/useOrderForDelivery'
import { supabase } from '../lib/supabase'
import { useOrdersSync } from '../hooks/useOrdersSync'

interface DeliveryFormData {
  amount: number
  memo?: string
}

const createDeliverySchema = (maxAmount: number) =>
  yup.object({
    amount: yup
      .number()
      .typeError('数値を入力してください')
      .positive('0より大きい値を入力してください')
      .max(maxAmount, `残額¥${maxAmount.toLocaleString()}を超えています`)
      .required('納品金額は必須です'),
    memo: yup
      .string()
      .max(200, '備考は200文字以内で入力してください')
      .optional(),
  })

export const DeliveryModal = () => {
  const { isOpen, selectedOrderId, close } = useDeliveryModal()
  const queryClient = useQueryClient()
  const { syncOrderData } = useOrdersSync()
  
  const { data: orderData, isLoading, isError, error } = useOrderForDelivery(selectedOrderId)
  
  const form = useForm<DeliveryFormData>({
    resolver: orderData ? yupResolver(createDeliverySchema(orderData.remaining_amount)) : undefined,
    defaultValues: { amount: 0, memo: '' },
    mode: 'onChange',
  })

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
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          id: crypto.randomUUID(),
          transaction_type: 'purchase',
          status: 'confirmed',
          partner_id: orderData.partner_id,
          total_amount: data.amount,
          parent_order_id: orderData.purchase_order_id,
          delivery_sequence: nextSequence,
          transaction_date: new Date().toISOString().split('T')[0],
          memo: data.memo || `分納入力 - ${orderData.order_no} (${nextSequence}回目)`,
          created_at: new Date().toISOString(),
        })
      
      if (insertError) throw insertError
    },
    onSuccess: async () => {
      try {
        // useOrdersSync が正常に動作する場合
        if (syncOrderData && typeof syncOrderData === 'function') {
          await syncOrderData('分納を登録しました');
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
                {...form.register('amount', { valueAsNumber: true })}
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