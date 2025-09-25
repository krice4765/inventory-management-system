import React from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'

import { useAddInstallmentModal } from '../stores/addInstallmentModal.store'
import { useOrderWithProducts } from '../hooks/useOrderWithProducts'
import { useAddInstallment } from '../hooks/useTransactions'
import { InstallmentProgress } from './InstallmentProgress'

interface InstallmentFormData {
  amount: number
  status: 'draft' | 'confirmed'
  dueDate?: string
  memo?: string
  quantities: { [productId: string]: number }
  includeProducts: boolean
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
    quantities: yup
      .object()
      .optional(),
    includeProducts: yup
      .boolean()
      .optional(),
  })

export const AddInstallmentModal = () => {
  const { isOpen, selectedOrderId, close } = useAddInstallmentModal()
  const addInstallmentMutation = useAddInstallment()
  
  const { data: orderData, isLoading, isError, error, refetch } = useOrderWithProducts(selectedOrderId)
  
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
      memo: '',
      quantities: {},
      includeProducts: true  // 商品情報を常に含めるようにデフォルト値をtrueに変更
    },
    mode: 'onChange',
  })

  // 残額が変わったときにデフォルト金額と商品数量を更新
  React.useEffect(() => {
    if (orderData && orderData.remaining_amount > 1) {
      form.setValue('amount', orderData.remaining_amount, { shouldValidate: true })

      // 全残額の場合は、すべての商品の未納品数量を設定
      const remainingQuantities: { [productId: string]: number } = {}
      orderData.products.forEach(product => {
        const remainingQty = product.quantity - product.delivered_quantity
        if (remainingQty > 0) {
          remainingQuantities[product.product_id] = remainingQty
        }
      })
      form.setValue('quantities', remainingQuantities, { shouldValidate: true })
    } else if (orderData && orderData.remaining_amount === 0) {
      form.setValue('amount', 0, { shouldValidate: true })
      form.setValue('quantities', {}, { shouldValidate: true })
    }
  }, [orderData, form])
  
  // モーダルが閉じるときにフォームをリセット
  React.useEffect(() => {
    if (!isOpen) {
      form.reset({
        amount: 0,
        status: 'draft',
        dueDate: defaultDueDateString,
        memo: '',
        quantities: {},
        includeProducts: true  // リセット時も商品情報を含める
      })
    }
  }, [isOpen, form, defaultDueDateString])

  // クイック金額設定
  const setQuickAmount = (percentage: number) => {
    if (!orderData) return
    const amount = Math.floor(orderData.remaining_amount * percentage)
    form.setValue('amount', amount, { shouldValidate: true })
  }

  // 商品数量変更ハンドラ
  const handleQuantityChange = (productId: string, quantity: number) => {
    const currentQuantities = form.getValues('quantities') || {}
    const newQuantities = { ...currentQuantities, [productId]: quantity }
    form.setValue('quantities', newQuantities, { shouldValidate: true })

    // 商品情報が選択されている場合、金額を自動計算
    if (form.getValues('includeProducts')) {
      const totalAmount = Object.entries(newQuantities)
        .filter(([_, qty]) => qty > 0)
        .reduce((sum, [productId, qty]) => {
          const product = orderData?.products.find(p => p.product_id === productId)
          return sum + (product ? product.unit_price * qty : 0)
        }, 0)

      if (totalAmount > 0) {
        form.setValue('amount', totalAmount, { shouldValidate: true })
      }
    }
  }

  // 商品情報含有モード切り替え
  const toggleProductMode = (include: boolean) => {
    form.setValue('includeProducts', include, { shouldValidate: true })
    if (!include) {
      form.setValue('quantities', {}, { shouldValidate: true })
    }
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
        quantities: data.includeProducts ? data.quantities : undefined,
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

            {orderData.remaining_amount <= 1 ? (
              <div className="p-3 bg-amber-50 text-amber-700 rounded mb-4">
                ✅ この発注は完了しています（残額: ¥1以下）
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

                {/* 商品情報選択モード */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <label className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      checked={form.watch('includeProducts')}
                      onChange={(e) => toggleProductMode(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="font-medium text-gray-700">商品情報を指定して分納</span>
                  </label>

                  {form.watch('includeProducts') && orderData && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 mb-3">
                        分納する商品と数量を指定してください。金額は自動計算されます。
                      </p>
                      {orderData.products.map(product => (
                        <div key={product.product_id} className="flex items-center justify-between bg-white p-3 rounded border">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {product.product_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {product.product_code} - ¥{product.unit_price.toLocaleString()} / 個
                            </p>
                            <p className="text-xs text-gray-500">
                              発注数量: {product.quantity}個
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">数量:</span>
                            <input
                              type="number"
                              min="0"
                              max={product.quantity}
                              value={form.watch('quantities')?.[product.product_id] || 0}
                              onChange={(e) => handleQuantityChange(product.product_id, parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <span className="text-sm text-gray-600">個</span>
                          </div>
                        </div>
                      ))}

                      {/* 商品選択時の合計表示 */}
                      {Object.values(form.watch('quantities') || {}).some(qty => qty > 0) && (
                        <div className="bg-blue-50 p-3 rounded border border-blue-200">
                          <p className="text-sm text-blue-700 font-medium">
                            選択商品合計: ¥{Object.entries(form.watch('quantities') || {})
                              .filter(([_, qty]) => qty > 0)
                              .reduce((sum, [productId, qty]) => {
                                const product = orderData.products.find(p => p.product_id === productId)
                                return sum + (product ? product.unit_price * qty : 0)
                              }, 0).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 分納金額入力 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    分納金額 <span className="text-red-500">*</span>
                    {form.watch('includeProducts') && (
                      <span className="text-sm text-blue-600 ml-2">(商品選択時は自動計算)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="1"
                    {...form.register('amount', { valueAsNumber: true })}
                    disabled={form.watch('includeProducts')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      form.formState.errors.amount ? 'border-red-300' : 'border-gray-300'
                    } ${
                      form.watch('includeProducts') ? 'bg-gray-100 cursor-not-allowed' : ''
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
                      <span className="text-sm">下書き</span>
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
              {orderData && orderData.remaining_amount > 1 && (
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