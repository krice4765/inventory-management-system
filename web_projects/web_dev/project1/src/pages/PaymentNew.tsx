import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentFormSchema, PaymentFormData } from '../lib/validations';
import { FormField, FormInput, FormTextarea } from '../components/FormField';
import { PaymentMethodInput } from '../components/PaymentMethodInput';

interface AccountsPayable {
  id: string;
  supplier_id: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  due_date: string;
  invoice_date: string;
  partners: {
    name: string;
    partner_code: string;
  };
}

export default function PaymentNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const payableId = searchParams.get('payable_id');
  const payableIds = searchParams.get('payable_ids');
  const isBatchMode = searchParams.get('batch') === 'true';

  const [payable, setPayable] = useState<AccountsPayable | null>(null);
  const [payables, setPayables] = useState<AccountsPayable[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
      payment_method_cash: 0,
      payment_method_check: 0,
      payment_method_note: 0,
      payment_method_bank_transfer: 0,
      payment_method_offset: 0,
      discount_amount: 0,
      other_amount: 0,
      transaction_fee: 0,
      issuing_bank_name: '',
      payee_bank_name: '',
      notes: '',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = form;

  useEffect(() => {
    if (isBatchMode && payableIds) {
      fetchPayables(payableIds);
    } else if (payableId) {
      fetchPayable(payableId);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payableId, payableIds, isBatchMode]);

  const fetchPayable = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('accounts_payable')
        .select(`
          *,
          partners!supplier_id (name, partner_code)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Check if payable is already paid
      if (data.status === 'paid' || data.balance <= 0) {
        toast.error('この買掛金はすでに支払済みです');
        navigate('/accounts-payable');
        return;
      }

      setPayable(data);
    } catch (error) {
      console.error('Error fetching payable:', error);

      if (error?.code === 'PGRST116') {
        toast.error('指定された買掛金が見つかりません');
      } else if (error?.message) {
        toast.error(`買掛金情報の取得に失敗しました: ${error.message}`);
      } else {
        toast.error('買掛金情報の取得に失敗しました');
      }

      navigate('/accounts-payable');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayables = async (ids: string) => {
    try {
      const idArray = ids.split(',');
      const { data, error } = await supabase
        .from('accounts_payable')
        .select(`
          *,
          partners!supplier_id (name, partner_code)
        `)
        .in('id', idArray);

      if (error) throw error;

      // Filter out already paid payables
      const validPayables = data.filter(
        p => p.status !== 'paid' && p.balance > 0
      );

      if (validPayables.length === 0) {
        toast.error('選択された買掛金はすでに支払済みです');
        navigate('/accounts-payable');
        return;
      }

      if (validPayables.length < data.length) {
        toast.warning(`${data.length - validPayables.length}件の買掛金は既に支払済みのため除外されました`);
      }

      setPayables(validPayables);
    } catch (error) {
      console.error('Error fetching payables:', error);
      toast.error('買掛金情報の取得に失敗しました');
      navigate('/accounts-payable');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (formData: PaymentFormData, totalPaymentAmount: number) => {
    if (payables.length === 0) {
      toast.error('買掛金情報が見つかりません');
      return;
    }

    // Calculate total balance from all payables
    const totalBalance = payables.reduce((sum, p) => sum + p.balance, 0);

    // Validate payment amount matches total balance
    if (totalPaymentAmount !== totalBalance) {
      toast.error(`支払金額合計(¥${totalPaymentAmount.toLocaleString()})が残高合計(¥${totalBalance.toLocaleString()})と一致しません`);
      return;
    }

    try {
      // Create payment transactions and update payables for each
      const paymentPromises = payables.map(async (payable) => {
        // Calculate proportional payment amount for this payable
        const paymentAmount = payable.balance;

        // Calculate proportional payment method amounts based on this payable's share of total
        const ratio = paymentAmount / totalBalance;

        // 1. Create payment_transaction entry
        const { error: paymentError } = await supabase
          .from('payment_transactions')
          .insert({
            transaction_type: 'payable',
            accounts_payable_id: payable.id,
            partner_id: payable.supplier_id,
            amount: paymentAmount,
            payment_date: formData.payment_date,
            payment_method_cash: Math.round((formData.payment_method_cash || 0) * ratio),
            payment_method_check: Math.round((formData.payment_method_check || 0) * ratio),
            payment_method_note: Math.round((formData.payment_method_note || 0) * ratio),
            payment_method_bank_transfer: Math.round((formData.payment_method_bank_transfer || 0) * ratio),
            payment_method_offset: Math.round((formData.payment_method_offset || 0) * ratio),
            discount_amount: Math.round((formData.discount_amount || 0) * ratio),
            other_amount: Math.round((formData.other_amount || 0) * ratio),
            transaction_fee: Math.round((formData.transaction_fee || 0) * ratio),
            issuing_bank_name: formData.issuing_bank_name || null,
            payee_bank_name: formData.payee_bank_name || null,
            notes: formData.notes || null,
          });

        if (paymentError) throw paymentError;

        // 2. Update accounts_payable
        const newPaidAmount = (payable.paid_amount || 0) + paymentAmount;

        const { error: updateError } = await supabase
          .from('accounts_payable')
          .update({
            paid_amount: newPaidAmount,
            status: 'paid',
            payment_date: formData.payment_date,
          })
          .eq('id', payable.id);

        if (updateError) throw updateError;
      });

      await Promise.all(paymentPromises);

      toast.success(`${payables.length}件の支払を一括登録しました（合計: ¥${totalPaymentAmount.toLocaleString()}）`);
      navigate('/accounts-payable');
    } catch (error) {
      console.error('Error creating batch payment:', error);

      if (error?.code === '23505') {
        toast.error('この支払はすでに登録されています');
      } else if (error?.code === '23503') {
        toast.error('参照データが見つかりません。ページを更新してください');
      } else if (error?.message) {
        toast.error(`支払の登録に失敗しました: ${error.message}`);
      } else {
        toast.error('支払の登録に失敗しました。もう一度お試しください');
      }
    }
  };

  const onSubmit = async (formData: PaymentFormData) => {
    // Calculate total payment amount from all methods
    const totalPaymentAmount =
      Number(formData.payment_method_cash || 0) +
      Number(formData.payment_method_check || 0) +
      Number(formData.payment_method_note || 0) +
      Number(formData.payment_method_bank_transfer || 0) +
      Number(formData.payment_method_offset || 0) +
      Number(formData.discount_amount || 0) +
      Number(formData.other_amount || 0) +
      Number(formData.transaction_fee || 0);

    if (totalPaymentAmount === 0) {
      toast.error('支払金額を入力してください');
      return;
    }

    if (isBatchMode) {
      return handleBatchSubmit(formData, totalPaymentAmount);
    }

    // Single payment mode validation
    if (!payable) {
      toast.error('買掛金情報が見つかりません');
      return;
    }

    // Additional validation: Check if already paid
    if (payable.status === 'paid' || payable.balance <= 0) {
      toast.error('この買掛金はすでに支払済みです');
      return;
    }

    // Additional validation: Check amount doesn't exceed balance
    if (totalPaymentAmount > payable.balance) {
      toast.error(`支払金額合計(¥${totalPaymentAmount.toLocaleString()})が残高(¥${payable.balance.toLocaleString()})を超えています`);
      return;
    }

    try {
      // 1. payment_transactionsに支払記録を作成（複数支払方法対応）
      const { error: paymentError } = await supabase
        .from('payment_transactions')
        .insert({
          transaction_type: 'payable',
          accounts_payable_id: payable.id,
          partner_id: payable.supplier_id,
          amount: totalPaymentAmount,
          payment_date: formData.payment_date,
          // 複数支払方法
          payment_method_cash: formData.payment_method_cash || 0,
          payment_method_check: formData.payment_method_check || 0,
          payment_method_note: formData.payment_method_note || 0,
          payment_method_bank_transfer: formData.payment_method_bank_transfer || 0,
          payment_method_offset: formData.payment_method_offset || 0,
          discount_amount: formData.discount_amount || 0,
          other_amount: formData.other_amount || 0,
          transaction_fee: formData.transaction_fee || 0,
          issuing_bank_name: formData.issuing_bank_name || null,
          payee_bank_name: formData.payee_bank_name || null,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // 2. accounts_payableを更新
      const newPaidAmount = (payable.paid_amount || 0) + totalPaymentAmount;
      const newBalance = payable.total_amount - newPaidAmount;

      // ステータス判定: unpaid → partial → paid
      let newStatus: 'unpaid' | 'partial' | 'paid';
      if (newBalance <= 0) {
        newStatus = 'paid';  // 全額支払済み
      } else if (newPaidAmount > 0) {
        newStatus = 'partial';  // 一部支払済み
      } else {
        newStatus = 'unpaid';  // 未払い
      }

      const { error: updateError } = await supabase
        .from('accounts_payable')
        .update({
          paid_amount: newPaidAmount,
          // balance is a generated column (total_amount - paid_amount), don't update it manually
          status: newStatus,
          payment_date: newStatus === 'paid' ? formData.payment_date : null,
        })
        .eq('id', payable.id);

      if (updateError) throw updateError;

      toast.success(`支払を登録しました（合計: ¥${totalPaymentAmount.toLocaleString()}）`);
      navigate('/accounts-payable');
    } catch (error) {
      console.error('Error creating payment:', error);

      // Provide specific error messages based on error code
      if (error?.code === '23505') {
        toast.error('この支払はすでに登録されています');
      } else if (error?.code === '23503') {
        toast.error('参照データが見つかりません。ページを更新してください');
      } else if (error?.code === '428C9') {
        toast.error('データベース制約エラーが発生しました');
      } else if (error?.message) {
        toast.error(`支払の登録に失敗しました: ${error.message}`);
      } else {
        toast.error('支払の登録に失敗しました。もう一度お試しください');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isBatchMode && !payable) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 font-medium">買掛金情報が見つかりません</p>
          <button
            onClick={() => navigate('/accounts-payable')}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            買掛金一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  if (isBatchMode && payables.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 font-medium">選択された買掛金が見つかりません</p>
          <button
            onClick={() => navigate('/accounts-payable')}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            買掛金一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  // Calculate total balance
  const totalBalance = isBatchMode
    ? payables.reduce((sum, p) => sum + p.balance, 0)
    : payable?.balance || 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/accounts-payable')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          買掛金一覧に戻る
        </button>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          {isBatchMode ? '一括支払登録' : '支払登録'}
        </h1>
      </div>

      {/* Payable Info Card */}
      {isBatchMode ? (
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
          <h2 className="text-lg font-medium text-blue-100 mb-4">一括支払対象 ({payables.length}件)</h2>
          <div className="mb-4">
            <p className="text-blue-100 text-sm mb-2">合計残高</p>
            <p className="text-4xl font-bold">¥{totalBalance.toLocaleString()}</p>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2 border-t border-blue-400 pt-4">
            {payables.map((p, index) => (
              <div key={p.id} className="bg-white/10 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{index + 1}. {p.partners.name}</p>
                    <p className="text-xs text-blue-200">{p.partners.partner_code}</p>
                  </div>
                  <p className="font-bold">¥{p.balance.toLocaleString()}</p>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-blue-200">
                  <span>請求日: {new Date(p.invoice_date).toLocaleDateString('ja-JP')}</span>
                  <span>期限: {new Date(p.due_date).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : payable ? (
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
          <h2 className="text-lg font-medium text-blue-100 mb-4">支払対象</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-blue-100 text-sm mb-1">仕入先</p>
              <p className="text-2xl font-bold">{payable.partners.name}</p>
              <p className="text-blue-200 text-sm">{payable.partners.partner_code}</p>
            </div>
            <div className="text-right">
              <p className="text-blue-100 text-sm mb-1">残高</p>
              <p className="text-3xl font-bold">¥{payable.balance.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-400 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-200">請求日</p>
              <p className="font-medium">{new Date(payable.invoice_date).toLocaleDateString('ja-JP')}</p>
            </div>
            <div className="text-right">
              <p className="text-blue-200">支払期限</p>
              <p className="font-medium">{new Date(payable.due_date).toLocaleDateString('ja-JP')}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Payment Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-200 rounded-2xl shadow-xl p-8 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">支払情報</h2>

        {/* Payment Date */}
        <FormField
          label="支払日"
          required
          error={errors.payment_date}
          icon={<Calendar className="w-4 h-4" />}
        >
          <FormInput
            type="date"
            error={errors.payment_date}
            {...register('payment_date')}
          />
        </FormField>

        {/* Payment Methods (複数支払方法) */}
        <PaymentMethodInput form={form} totalAmount={totalBalance} />

        {/* Notes */}
        <FormField label="備考" error={errors.notes}>
          <FormTextarea
            rows={3}
            error={errors.notes}
            placeholder="備考を入力（任意）"
            {...register('notes')}
          />
        </FormField>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/accounts-payable')}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                登録中...
              </span>
            ) : (
              '支払を登録'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
