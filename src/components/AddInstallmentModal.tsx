import React from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'

import { useAddInstallmentModal } from '../stores/addInstallmentModal.store'
import { useOrderForInstallment } from '../hooks/useOrderForInstallment'
import { useAddInstallment } from '../hooks/useTransactions'
import { InstallmentProgress } from './InstallmentProgress'

interface InstallmentFormData {
  amount: number
  status: 'draft' | 'confirmed'
  dueDate?: string
  memo?: string
}

const createInstallmentSchema = (maxAmount: number) =>
  yup.object({
    amount: yup
      .number()
      .typeError('数値を入力してください')
      .positive('0より大きい値を入力してください')
      .max(maxAmount, `残額¥${maxAmount.toLocaleString()}を超えています`)
      .required('分納金額は必須です'),
    status: yup
      .string()
      .oneOf(['draft', 'confirmed'])
      .required('ステータスを選択してください'),
    dueDate: yup
      .string()
      .optional(),
    memo: yup
      .string()
      .max(200, '備考は200文字以内で入力してください')
      .optional(),
  })

export const AddInstallmentModal = () => {
  const { isOpen, selectedOrderId, close } = useAddInstallmentModal()
  const addInstallmentMutation = useAddInstallment()
  
  const { data: orderData, isLoading, isError, error, refetch } = useOrderForInstallment(selectedOrderId)
  
  // モーダルが開いたときに最新のデータを取得
  React.useEffect(() => {
    if (isOpen && selectedOrderId) {
      refetch()
    }
  }, [isOpen, selectedOrderId, refetch])
  
  // デフォルト期日（30日後）
  const defaultDueDate = new Date()
  defaultDueDate.setDate(defaultDueDate.getDate() + 30)
  const defaultDueDateString = defaultDueDate.toISOString().split('T')[0]

  const form = useForm<InstallmentFormData>({
    resolver: orderData ? yupResolver(createInstallmentSchema(orderData.remaining_amount)) : undefined,
    defaultValues: { 
      amount: orderData?.remaining_amount || 0, 
      status: 'draft',
      dueDate: defaultDueDateString,
      memo: '' 
    },
    mode: 'onChange',
  })

  // 残額が変わったときにデフォルト金額を更新
  React.useEffect(() => {
    if (orderData && orderData.remaining_amount > 0) {
      form.setValue('amount', orderData.remaining_amount, { shouldValidate: true })
    } else if (orderData && orderData.remaining_amount === 0) {
      form.setValue('amount', 0, { shouldValidate: true })
    }
  }, [orderData, form])
  
  // モーダルが閉じるときにフォームをリセット
  React.useEffect(() => {
    if (!isOpen) {
      form.reset({
        amount: 0,
        status: 'draft',
        dueDate: defaultDueDateString,
        memo: ''
      })
    }
  }, [isOpen, form, defaultDueDateString])

  // クイック金額設定
  const setQuickAmount = (percentage: number) => {
    if (!orderData) return
    const amount = Math.floor(orderData.remaining_amount * percentage)
    form.setValue('amount', amount, { shouldValidate: true })
  }

  const handleSubmit = async (data: InstallmentFormData) => {
    if (!orderData) return
    
    // 追加バリデーション
    if (data.amount <= 0) {
      form.setError('amount', { message: '金額は0より大きい値を入力してください' })
      return
    }
    
    if (data.amount > orderData.remaining_amount) {
      form.setError('amount', { message: `残額¥${orderData.remaining_amount.toLocaleString()}を超えています` })
      return
    }
    
    // 確定状態での追加安全性チェック
    if (data.status === 'confirmed' && (orderData.allocated_amount + data.amount) > orderData.total_amount) {
      form.setError('amount', { message: '確定状態では発注金額を超過できません' })
      return
    }
    
    try {
      await addInstallmentMutation.mutateAsync({
        parentOrderId: orderData.purchase_order_id,
        amount: data.amount,
        status: data.status,
        dueDate: data.dueDate,
        memo: data.memo,
      })
      
      form.reset()
      close()
    } catch (error) {
      // エラーはuseAddInstallmentで処理済み
      console.error('分納追加エラー:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">分納追加</h3>
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
          <form onSubmit={form.handleSubmit(handleSubmit)}>
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
                  <p className="font-medium">¥{orderData.total_amount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-blue-700">既分納:</span>
                  <p className="font-medium">¥{orderData.allocated_amount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-blue-700 font-semibold">残額:</span>
                  <p className="font-bold text-lg">¥{orderData.remaining_amount.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-blue-600">
                現在 {orderData.installment_count} 回分納済み → 次回は第{orderData.installment_count + 1}回分納
              </div>
              
              {/* 進捗バー */}
              <div className="mt-4">
                <InstallmentProgress 
                  orderTotal={orderData.total_amount}
                  allocatedAmount={orderData.allocated_amount}
                />
              </div>
            </div>

            {orderData.remaining_amount <= 0 ? (
              <div className="p-3 bg-amber-50 text-amber-700 rounded mb-4">
                この発注の分納金額は既に発注金額に達しています。
              </div>
            ) : (
              <>
                {/* クイック入力ボタン */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    クイック金額設定
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
                      onClick={() => setQuickAmount(0.5)}
                      className="p-2 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    >
                      50%<br/>¥{Math.floor(orderData.remaining_amount * 0.5).toLocaleString()}
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickAmount(0.7)}
                      className="p-2 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                    >
                      70%<br/>¥{Math.floor(orderData.remaining_amount * 0.7).toLocaleString()}
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

                {/* 分納金額入力 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    分納金額 <span className="text-red-500">*</span>
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

                {/* ステータス選択 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ステータス <span className="text-red-500">*</span>
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="draft"
                        {...form.register('status')}
                        className="mr-2"
                      />
                      <span className="text-sm">未確定</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="confirmed"
                        {...form.register('status')}
                        className="mr-2"
                      />
                      <span className="text-sm">確定</span>
                    </label>
                  </div>
                  {form.formState.errors.status && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.status.message}
                    </p>
                  )}
                </div>

                {/* 支払期日入力 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    支払期日
                  </label>
                  <input
                    type="date"
                    {...form.register('dueDate')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {form.formState.errors.dueDate && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.dueDate.message}
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
              </>
            )}

            {/* アクションボタン */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              {orderData && orderData.remaining_amount > 0 && (
                <button
                  type="submit"
                  disabled={addInstallmentMutation.isPending || !form.formState.isValid}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addInstallmentMutation.isPending ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      追加中...
                    </span>
                  ) : (
                    '分納追加'
                  )}
                </button>
              )}
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