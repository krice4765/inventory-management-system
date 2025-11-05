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

interface AccountsReceivable {
  id: string;
  customer_id: string;
  total_amount: number;
  received_amount: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  due_date: string;
  invoice_date: string;
  partners: {
    name: string;
    partner_code: string;
  };
}

export default function ReceiptNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const receivableId = searchParams.get('receivable_id');
  const receivableIds = searchParams.get('receivable_ids');
  const isBatchMode = searchParams.get('batch') === 'true';

  const [receivable, setReceivable] = useState<AccountsReceivable | null>(null);
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
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
    if (isBatchMode && receivableIds) {
      fetchReceivables(receivableIds);
    } else if (receivableId) {
      fetchReceivable(receivableId);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivableId, receivableIds, isBatchMode]);

  const fetchReceivable = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select(`
          *,
          partners!customer_id (name, partner_code)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Check if receivable is already paid
      if (data.status === 'paid' || data.balance <= 0) {
        toast.error('この売掛金はすでに入金済みです');
        navigate('/accounts-receivable');
        return;
      }

      setReceivable(data);
    } catch (error: any) {
      console.error('Error fetching receivable:', error);

      if (error?.code === 'PGRST116') {
        toast.error('指定された売掛金が見つかりません');
      } else if (error?.message) {
        toast.error(`売掛金情報の取得に失敗しました: ${error.message}`);
      } else {
        toast.error('売掛金情報の取得に失敗しました');
      }

      navigate('/accounts-receivable');
    } finally {
      setLoading(false);
    }
  };

  const fetchReceivables = async (ids: string) => {
    try {
      const idArray = ids.split(',');
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select(`
          *,
          partners!customer_id (name, partner_code)
        `)
        .in('id', idArray);

      if (error) throw error;

      // Filter out already paid receivables
      const validReceivables = data.filter(
        r => r.status !== 'paid' && r.balance > 0
      );

      if (validReceivables.length === 0) {
        toast.error('選択された売掛金はすでに入金済みです');
        navigate('/accounts-receivable');
        return;
      }

      if (validReceivables.length < data.length) {
        toast.warning(`${data.length - validReceivables.length}件の売掛金は既に入金済みのため除外されました`);
      }

      setReceivables(validReceivables);
    } catch (error: any) {
      console.error('Error fetching receivables:', error);
      toast.error('売掛金情報の取得に失敗しました');
      navigate('/accounts-receivable');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (formData: PaymentFormData, totalReceiptAmount: number) => {
    if (receivables.length === 0) {
      toast.error('売掛金情報が見つかりません');
      return;
    }

    // Calculate total balance from all receivables
    const totalBalance = receivables.reduce((sum, r) => sum + r.balance, 0);

    // Validate receipt amount matches total balance
    if (totalReceiptAmount !== totalBalance) {
      toast.error(`入金金額合計(¥${totalReceiptAmount.toLocaleString()})が残高合計(¥${totalBalance.toLocaleString()})と一致しません`);
      return;
    }

    try {
      // Create receipt transactions and update receivables for each
      const receiptPromises = receivables.map(async (receivable) => {
        // Calculate proportional receipt amount for this receivable
        const receiptAmount = receivable.balance;

        // Calculate proportional payment method amounts based on this receivable's share of total
        const ratio = receiptAmount / totalBalance;

        // 1. Create receipt_transaction entry
        const { error: receiptError } = await supabase
          .from('receipt_transactions')
          .insert({
            transaction_type: 'receivable',
            accounts_receivable_id: receivable.id,
            partner_id: receivable.customer_id,
            amount: receiptAmount,
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

        if (receiptError) throw receiptError;

        // 2. Update accounts_receivable
        const newReceivedAmount = (receivable.received_amount || 0) + receiptAmount;

        const { error: updateError } = await supabase
          .from('accounts_receivable')
          .update({
            received_amount: newReceivedAmount,
            status: 'paid',
          })
          .eq('id', receivable.id);

        if (updateError) throw updateError;
      });

      await Promise.all(receiptPromises);

      toast.success(`${receivables.length}件の入金を一括登録しました（合計: ¥${totalReceiptAmount.toLocaleString()}）`);
      navigate('/accounts-receivable');
    } catch (error: any) {
      console.error('Error creating batch receipt:', error);

      // Provide specific error messages
      if (error?.code === '23505') {
        toast.error('この入金はすでに登録されています');
      } else if (error?.code === '23503') {
        toast.error('参照データが見つかりません。ページを更新してください');
      } else if (error?.code === '428C9') {
        toast.error('データベース制約エラーが発生しました');
      } else if (error?.message) {
        toast.error(`入金の登録に失敗しました: ${error.message}`);
      } else {
        toast.error('入金の登録に失敗しました。もう一度お試しください');
      }
    }
  };

  const onSubmit = async (formData: PaymentFormData) => {
    // Calculate total receipt amount from all methods
    const totalReceiptAmount =
      Number(formData.payment_method_cash || 0) +
      Number(formData.payment_method_check || 0) +
      Number(formData.payment_method_note || 0) +
      Number(formData.payment_method_bank_transfer || 0) +
      Number(formData.payment_method_offset || 0) +
      Number(formData.discount_amount || 0) +
      Number(formData.other_amount || 0) +
      Number(formData.transaction_fee || 0);

    // Route to batch submit if in batch mode
    if (isBatchMode) {
      await handleBatchSubmit(formData, totalReceiptAmount);
      return;
    }

    if (!receivable) {
      toast.error('売掛金情報が見つかりません');
      return;
    }

    // Additional validation: Check if already paid
    if (receivable.status === 'paid' || receivable.balance <= 0) {
      toast.error('この売掛金はすでに入金済みです');
      return;
    }

    // Additional validation: Check amount doesn't exceed balance
    if (totalReceiptAmount > receivable.balance) {
      toast.error(`入金金額合計(¥${totalReceiptAmount.toLocaleString()})が残高(¥${receivable.balance.toLocaleString()})を超えています`);
      return;
    }

    if (totalReceiptAmount === 0) {
      toast.error('入金金額を入力してください');
      return;
    }

    try {
      // 1. receipt_transactionsに入金記録を作成（複数入金方法対応）
      const { error: receiptError } = await supabase
        .from('receipt_transactions')
        .insert({
          transaction_type: 'receivable',
          accounts_receivable_id: receivable.id,
          partner_id: receivable.customer_id,
          amount: totalReceiptAmount,
          payment_date: formData.payment_date,
          // 複数入金方法
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

      if (receiptError) throw receiptError;

      // 2. accounts_receivableを更新
      const newReceivedAmount = (receivable.received_amount || 0) + totalReceiptAmount;
      const newBalance = receivable.total_amount - newReceivedAmount;

      // ステータス判定: unpaid → partial → paid
      let newStatus: 'unpaid' | 'partial' | 'paid';
      if (newBalance <= 0) {
        newStatus = 'paid';  // 全額入金済み
      } else if (newReceivedAmount > 0) {
        newStatus = 'partial';  // 一部入金済み
      } else {
        newStatus = 'unpaid';  // 未入金
      }

      const { error: updateError } = await supabase
        .from('accounts_receivable')
        .update({
          received_amount: newReceivedAmount,
          // balance is a generated column (total_amount - received_amount), don't update it manually
          status: newStatus,
        })
        .eq('id', receivable.id);

      if (updateError) throw updateError;

      toast.success(`入金を登録しました（合計: ¥${totalReceiptAmount.toLocaleString()}）`);
      navigate('/accounts-receivable');
    } catch (error: any) {
      console.error('Error creating receipt:', error);

      // Provide specific error messages based on error code
      if (error?.code === '23505') {
        toast.error('この入金はすでに登録されています');
      } else if (error?.code === '23503') {
        toast.error('参照データが見つかりません。ページを更新してください');
      } else if (error?.code === '428C9') {
        toast.error('データベース制約エラーが発生しました');
      } else if (error?.message) {
        toast.error(`入金の登録に失敗しました: ${error.message}`);
      } else {
        toast.error('入金の登録に失敗しました。もう一度お試しください');
      }
    }
  };

  // Calculate total balance for both modes
  const totalBalance = isBatchMode
    ? receivables.reduce((sum, r) => sum + r.balance, 0)
    : receivable?.balance || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isBatchMode && !receivable) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 font-medium">売掛金情報が見つかりません</p>
          <button
            onClick={() => navigate('/accounts-receivable')}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            売掛金一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/accounts-receivable')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          売掛金一覧に戻る
        </button>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          {isBatchMode ? '一括入金登録' : '入金登録'}
        </h1>
      </div>

      {/* Receivable Info Card */}
      {isBatchMode ? (
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
          <h2 className="text-lg font-medium text-blue-100 mb-4">一括入金対象 ({receivables.length}件)</h2>
          <div className="mb-4">
            <p className="text-blue-100 text-sm mb-2">合計残高</p>
            <p className="text-4xl font-bold">¥{totalBalance.toLocaleString()}</p>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2 border-t border-blue-400 pt-4">
            {receivables.map((r, index) => (
              <div key={r.id} className="bg-white/10 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{index + 1}. {r.partners.name}</p>
                    <p className="text-xs text-blue-200">{r.partners.partner_code}</p>
                  </div>
                  <p className="font-bold">¥{r.balance.toLocaleString()}</p>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-blue-200">
                  <span>請求日: {new Date(r.invoice_date).toLocaleDateString('ja-JP')}</span>
                  <span>期限: {new Date(r.due_date).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : receivable ? (
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white">
          <h2 className="text-lg font-medium text-green-100 mb-4">入金対象</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-green-100 text-sm mb-1">顧客</p>
              <p className="text-2xl font-bold">{receivable.partners.name}</p>
              <p className="text-green-200 text-sm">{receivable.partners.partner_code}</p>
            </div>
            <div className="text-right">
              <p className="text-green-100 text-sm mb-1">残高</p>
              <p className="text-3xl font-bold">¥{receivable.balance.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-green-400 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-green-200">請求日</p>
              <p className="font-medium">{new Date(receivable.invoice_date).toLocaleDateString('ja-JP')}</p>
            </div>
            <div className="text-right">
              <p className="text-green-200">入金期限</p>
              <p className="font-medium">{new Date(receivable.due_date).toLocaleDateString('ja-JP')}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Receipt Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-200 rounded-2xl shadow-xl p-8 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">入金情報</h2>

        {/* Receipt Date */}
        <FormField
          label="入金日"
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

        {/* Payment Methods (複数入金方法) */}
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
            onClick={() => navigate('/accounts-receivable')}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                登録中...
              </span>
            ) : (
              '入金を登録'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
