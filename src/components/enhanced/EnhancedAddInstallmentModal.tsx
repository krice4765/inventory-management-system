// ===============================================================
// 🎨 Phase 4: EnhancedAddInstallmentModal - リアルタイム検証UI
// ===============================================================
// 目的: 完全型安全性とリアルタイム検証による優れたUX

import React, { useEffect, useMemo } from 'react';
import { useForm, watch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import {
  useOrderInstallmentSummary,
  useCreateInstallment,
  useRemainingAmountCalculator,
  useInstallmentErrorHandler,
} from '../../hooks/useInstallmentService';
import { useAddInstallmentModal } from '../../stores/addInstallmentModal.store';
import type { 
  CreateInstallmentFormData, 
  InstallmentStatus,
  INSTALLMENT_CONFIG 
} from '../../types/installment';
import { INSTALLMENT_STATUS_LABELS } from '../../types/installment';

// 型定義
interface OrderSummary {
      order_no: string; partner_name: string; order_total: number; allocated_total: number; }

interface RemainingCalc {
      currentRemaining: number; }

interface FormType {
      watch: (field: string) => unknown; formState: { errors: Record<string, { message?: string }>;
  };
  register: (field: string, options?: unknown) => unknown;
}

// ===============================================================
// 1. フォームバリデーションスキーマ
// ===============================================================

const createInstallmentSchema = (maxAmount: number) =>
  yup.object({
      amount: yup .number()
      .typeError('数値を入力してください')
      .positive('0より大きい値を入力してください')
      .max(maxAmount, `残額¥${maxAmount.toLocaleString()}を超えています`)
      .min(INSTALLMENT_CONFIG.MIN_AMOUNT, `最小金額¥${INSTALLMENT_CONFIG.MIN_AMOUNT}以上を入力してください`)
      .required('分納金額は必須です'),
      status: yup .string()
      .oneOf(['draft', 'confirmed'] as InstallmentStatus[])
      .required('ステータスを選択してください'),
      dueDate: yup .string()
      .optional(),
      memo: yup .string()
      .max(500, 'メモは500文字以内で入力してください')
      .optional(),
  });

// ===============================================================
// 2. メインコンポーネント
// ===============================================================

export const EnhancedAddInstallmentModal: React.FC = () => {
  const { isOpen, selectedOrderId, close } = useAddInstallmentModal();
  const { formatError, showError } = useInstallmentErrorHandler();
  
  // データフェッチング
  const { data: orderSummary, isLoading, error, refetch } = useOrderInstallmentSummary(selectedOrderId);
  const { createInstallment, isCreating, createError } = useCreateInstallment();
  
  // フォーム管理
  const form = useForm<CreateInstallmentFormData>({
    resolver: orderSummary ? yupResolver(createInstallmentSchema(orderSummary.remaining_amount)) : undefined,
      defaultValues: { amount: 0,
      status: 'draft',
      dueDate: getDefaultDueDate(),
      memo: '',
    },
    mode: 'onChange',
  });
  
  // リアルタイム金額監視
  const watchedAmount = watch(form.watch)('amount') || 0;
  const remainingCalc = useRemainingAmountCalculator(selectedOrderId, watchedAmount);
  
  // ===============================================================
  // 3. フォーム初期化とリアルタイム更新
  // ===============================================================
  
  useEffect(() => {
    if (orderSummary) {
      // スキーマの再設定
      const _newSchema = createInstallmentSchema(orderSummary.remaining_amount);
      form.clearErrors();
      
      // デフォルト金額の設定（残額の100%）
      if (orderSummary.remaining_amount > 0) {
        form.setValue('amount', orderSummary.remaining_amount, { shouldValidate: true });
      }
    }
  }, [orderSummary, form]);
  
  // エラーハンドリング
  useEffect(() => {
    if (createError && !isCreating) {
      showError(createError);
    }
  }, [createError, isCreating, showError]);
  
  // ===============================================================
  // 4. クイック金額設定機能
  // ===============================================================
  
  const quickAmountButtons = useMemo(() => {
    if (!orderSummary || orderSummary.remaining_amount <= 0) return [];
    
    const remaining = orderSummary.remaining_amount;
    return [
      { percentage: 0.25, label: '25%', amount: Math.floor(remaining * 0.25) },
      { percentage: 0.5, label: '50%', amount: Math.floor(remaining * 0.5) },
      { percentage: 0.75, label: '75%', amount: Math.floor(remaining * 0.75) },
      { percentage: 1.0, label: '全額', amount: remaining },
    ];
  }, [orderSummary]);
  
      const setQuickAmount = (amount: number) => { form.setValue('amount', amount, { shouldValidate: true });
  };
  
  // ===============================================================
  // 5. フォーム送信処理
  // ===============================================================
  
      const handleSubmit = async (formData: CreateInstallmentFormData) => { if (!orderSummary) return;
    
    try {
      const result = await createInstallment({
        parentOrderId: orderSummary.order_id,
        amount: formData.amount,
        status: formData.status,
        dueDate: formData.dueDate,
        memo: formData.memo,
      });
      
      if (result.success) {
        form.reset();
        close();
      }
      // エラーハンドリングは useCreateInstallment 内で処理済み
    } catch (error) {
      console.error('Submit error:', error);
    }
  };
  
  // ===============================================================
  // 6. レンダリング条件
  // ===============================================================
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            分納追加 <span className="text-sm text-gray-500">(Enhanced v2.0)</span>
          </h3>
          <button 
            onClick={close}
      className="text-gray-400 hover: text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        {/* ローディング状態 */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">発注情報を読み込み中...</p>
          </div>
        )}

        {/* エラー状態 */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  発注情報の取得に失敗しました
                </h3>
                <p className="mt-1 text-sm text-red-700">{formatError(error)}</p>
                <button 
                  onClick={() => refetch()}
      className="mt-2 text-sm text-red-600 hover: text-red-500 underline">
                  再試行
                </button>
              </div>
            </div>
          </div>
        )}

        {/* メインコンテンツ */}
        {orderSummary && (
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            {/* 発注情報サマリー */}
            <OrderSummaryCard 
              orderSummary={orderSummary}
              remainingCalc={remainingCalc}
            />

            {orderSummary.remaining_amount <= 0 ? (
              <NoRemainingAmountMessage />
      ) : ( <>
                {/* クイック金額設定 */}
                <QuickAmountButtons 
                  buttons={quickAmountButtons}
                  onSetAmount={setQuickAmount}
                />

                {/* 分納金額入力 */}
                <AmountInput 
                  form={form}
                  remainingCalc={remainingCalc}
                />

                {/* ステータス選択 */}
                <StatusSelection form={form} />

                {/* 支払期日入力 */}
                <DueDateInput form={form} />

                {/* メモ入力 */}
                <MemoInput form={form} />

                {/* リアルタイム検証表示 */}
                <RealTimeValidation 
                  remainingCalc={remainingCalc}
                  formErrors={form.formState.errors}
                />
              </>
            )}

            {/* アクションボタン */}
            <ActionButtons 
              onCancel={close}
              isSubmitting={isCreating}
              isFormValid={form.formState.isValid && remainingCalc.isValid}
              hasRemainingAmount={orderSummary.remaining_amount > 0}
            />
          </form>
        )}
      </div>
    </div>
  );
};

// ===============================================================
// 7. サブコンポーネント群
// ===============================================================

const OrderSummaryCard: React.FC<{
      orderSummary: OrderSummary; remainingCalc: RemainingCalc; }> = ({ orderSummary, remainingCalc }) => (
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border border-blue-200">
    <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
      <span className="bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center text-xs text-blue-800 mr-2">
        📋
      </span>
      {orderSummary.order_no}
    </h4>
      <div className="grid grid-cols-2 md: grid-cols-4 gap-3 text-sm"><div>
        <span className="text-blue-700 block">仕入先</span>
        <p className="font-medium text-gray-900">{orderSummary.partner_name}</p>
      </div>
      <div>
        <span className="text-blue-700 block">発注額</span>
        <p className="font-medium text-gray-900">¥{orderSummary.order_total.toLocaleString()}</p>
      </div>
      <div>
        <span className="text-blue-700 block">既分納</span>
        <p className="font-medium text-gray-900">¥{orderSummary.allocated_total.toLocaleString()}</p>
      </div>
      <div>
        <span className="text-blue-700 font-semibold block">残額</span>
        <p className="font-bold text-lg text-green-600">¥{remainingCalc.currentRemaining.toLocaleString()}</p>
      </div>
    </div>
    
    {/* 進捗バー */}
    <div className="mt-3">
      <div className="flex justify-between text-xs text-blue-600 mb-1">
        <span>進捗: {orderSummary.completion_rate}%</span>
        <span>第{orderSummary.summary_info.next_installment_no}回分納</span>
      </div>
      <div className="w-full bg-blue-200 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-blue-400 to-indigo-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(orderSummary.completion_rate, 100)}%` }}
        />
      </div>
    </div>
  </div>
);

const NoRemainingAmountMessage: React.FC = () => (
  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
    <div className="flex items-center">
      <span className="text-2xl mr-2">⚠️</span>
      <div>
        <h4 className="text-amber-800 font-medium">分納完了済み</h4>
        <p className="text-amber-700 text-sm">この発注の分納金額は既に発注金額に達しています。</p>
      </div>
    </div>
  </div>
);

const QuickAmountButtons: React.FC<{
  buttons: Array<{percentage: number; label: string; amount: number}>;
      onSetAmount: (amount: number) => void; }> = ({ buttons, onSetAmount }) => (
  <div className="mb-6">
    <label className="block text-sm font-medium text-gray-700 mb-3">
      クイック金額設定
    </label>
    <div className="grid grid-cols-4 gap-2">
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          onClick={() => onSetAmount(button.amount)}
      className="p-3 text-xs bg-gradient-to-b from-blue-100 to-blue-200 text-blue-700 rounded-lg hover: from-blue-200 hover:to-blue-300 transition-all duration-200 border border-blue-300">
          <div className="font-semibold">{button.label}</div>
          <div className="text-blue-600">¥{button.amount.toLocaleString()}</div>
        </button>
      ))}
    </div>
  </div>
);

const AmountInput: React.FC<{
      form: FormType; remainingCalc: RemainingCalc; }> = ({ form, remainingCalc }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      分納金額 <span className="text-red-500">*</span>
    </label>
    <div className="relative">
      <input
        type="number"
        step="1"
        {...form.register('amount', { valueAsNumber: true })}
      className={`w-full px-4 py-3 border rounded-lg focus: outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium ${ form.formState.errors.amount || !remainingCalc.isValid
            ? 'border-red-300 bg-red-50'
      : remainingCalc.canAdd ? 'border-green-300 bg-green-50'
      : 'border-gray-300' }`}
        placeholder="0"
      />
      <div className="absolute right-3 top-3 text-gray-500">
        ¥
      </div>
    </div>
    {(form.formState.errors.amount || !remainingCalc.isValid) && (
      <p className="mt-1 text-sm text-red-600">
        {form.formState.errors.amount?.message || remainingCalc.errorMessage}
      </p>
    )}
  </div>
);

const StatusSelection: React.FC<{form: FormType}> = ({ form }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      ステータス <span className="text-red-500">*</span>
    </label>
    <div className="flex space-x-4">
      {(['draft', 'confirmed'] as const).map((status) => (
        <label key={status} className="flex items-center cursor-pointer">
          <input
            type="radio"
            value={status}
            {...form.register('status')}
            className="mr-2 h-4 w-4 text-blue-600"
          />
          <span className="text-sm font-medium text-gray-700">
            {INSTALLMENT_STATUS_LABELS[status]}
          </span>
        </label>
      ))}
    </div>
  </div>
);

const DueDateInput: React.FC<{form: FormType}> = ({ form }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      支払期日
    </label>
    <input
      type="date"
      {...form.register('dueDate')}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus: outline-none focus:ring-2 focus:ring-blue-500"/>
  </div>
);

const MemoInput: React.FC<{form: FormType}> = ({ form }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      備考
    </label>
    <textarea
      rows={3}
      {...form.register('memo')}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus: outline-none focus:ring-2 focus:ring-blue-500"placeholder="備考を入力..."
      maxLength={500}
    />
    <div className="text-xs text-gray-500 mt-1">
      {form.watch('memo')?.length || 0}/500文字
    </div>
  </div>
);

const RealTimeValidation: React.FC<{
      remainingCalc: RemainingCalc; formErrors: Record<string, { message?: string }>;
}> = ({ remainingCalc, formErrors: _formErrors }) => (
  <div className="mb-6 p-3 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
    <h4 className="text-sm font-medium text-gray-700 mb-2">リアルタイム検証結果</h4>
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div>
      <span className="text-gray-600">入力後残額: </span> <span className={`ml-2 font-semibold ${
      remainingCalc.afterAddition >= 0 ? 'text-green-600' : 'text-red-600' }`}>
          ¥{remainingCalc.afterAddition.toLocaleString()}
        </span>
      </div>
      <div>
      <span className="text-gray-600">追加可能: </span> <span className={`ml-2 font-semibold ${
      remainingCalc.canAdd ? 'text-green-600' : 'text-red-600' }`}>
          {remainingCalc.canAdd ? 'はい' : 'いいえ'}
        </span>
      </div>
    </div>
  </div>
);

const ActionButtons: React.FC<{
      onCancel: () => void; isSubmitting: boolean; isFormValid: boolean; hasRemainingAmount: boolean; }> = ({ onCancel, isSubmitting, isFormValid, hasRemainingAmount }) => (
  <div className="flex justify-end space-x-3">
    <button
      type="button"
      onClick={onCancel}
      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover: bg-gray-50 transition-colors">
      キャンセル
    </button>
    {hasRemainingAmount && (
      <button
        type="submit"
        disabled={isSubmitting || !isFormValid}
        className={`px-6 py-2 rounded-lg transition-all duration-200 ${
          isFormValid
      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover: from-blue-700 hover:to-indigo-700 text-white shadow-lg' : 'bg-gray-300 text-gray-500 cursor-not-allowed' }`}
      >
        {isSubmitting ? (
          <span className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            処理中...
          </span>
      ) : ( '分納追加'
        )}
      </button>
    )}
  </div>
);

// ===============================================================
// 8. ヘルパー関数
// ===============================================================

function getDefaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + INSTALLMENT_CONFIG.DEFAULT_DUE_DAYS);
  return date.toISOString().split('T')[0];
}