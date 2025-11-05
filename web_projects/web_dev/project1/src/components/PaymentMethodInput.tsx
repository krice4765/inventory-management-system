import { UseFormReturn } from 'react-hook-form';
import { FormField, FormInput } from './FormField';
import { PaymentFormData } from '../lib/validations';

interface PaymentMethodInputProps {
  form: UseFormReturn<PaymentFormData>;
  totalAmount: number;
}

export function PaymentMethodInput({ form, totalAmount }: PaymentMethodInputProps) {
  // 支払方法の合計を計算（リアルタイム監視）
  const watchedValues = form.watch([
    'payment_method_cash',
    'payment_method_check',
    'payment_method_note',
    'payment_method_bank_transfer',
    'payment_method_offset',
    'discount_amount',
    'other_amount',
    'transaction_fee'
  ]);

  // watchedValuesを使用してリアルタイムに合計を計算
  const paymentTotal =
    Number(watchedValues[0] || 0) + // payment_method_cash
    Number(watchedValues[1] || 0) + // payment_method_check
    Number(watchedValues[2] || 0) + // payment_method_note
    Number(watchedValues[3] || 0) + // payment_method_bank_transfer
    Number(watchedValues[4] || 0) + // payment_method_offset
    Number(watchedValues[5] || 0) + // discount_amount
    Number(watchedValues[6] || 0) + // other_amount
    Number(watchedValues[7] || 0);  // transaction_fee

  const difference = totalAmount - paymentTotal;

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
      <h3 className="text-lg font-semibold text-gray-900">支払方法</h3>

      {/* 支払金額の表示 */}
      <div className="grid grid-cols-3 gap-4 p-3 bg-white rounded border">
        <div>
          <div className="text-sm text-gray-600">支払対象金額</div>
          <div className="text-xl font-bold text-gray-900">¥{totalAmount.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">入力済み合計</div>
          <div className="text-xl font-bold text-blue-600">¥{paymentTotal.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">差額</div>
          <div className={`text-xl font-bold ${difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
            ¥{difference.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 支払方法入力欄 */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="現金" error={form.formState.errors.payment_method_cash}>
          <FormInput
            type="number"
            {...form.register('payment_method_cash', { valueAsNumber: true })}
            placeholder="0"
          />
        </FormField>

        <FormField label="小切手" error={form.formState.errors.payment_method_check}>
          <FormInput
            type="number"
            {...form.register('payment_method_check', { valueAsNumber: true })}
            placeholder="0"
          />
        </FormField>

        <FormField label="手形" error={form.formState.errors.payment_method_note}>
          <FormInput
            type="number"
            {...form.register('payment_method_note', { valueAsNumber: true })}
            placeholder="0"
          />
        </FormField>

        <FormField label="振込" error={form.formState.errors.payment_method_bank_transfer}>
          <FormInput
            type="number"
            {...form.register('payment_method_bank_transfer', { valueAsNumber: true })}
            placeholder="0"
          />
        </FormField>

        <FormField label="相殺" error={form.formState.errors.payment_method_offset}>
          <FormInput
            type="number"
            {...form.register('payment_method_offset', { valueAsNumber: true })}
            placeholder="0"
          />
        </FormField>

        <FormField label="値引き" error={form.formState.errors.discount_amount}>
          <FormInput
            type="number"
            {...form.register('discount_amount', { valueAsNumber: true })}
            placeholder="0"
          />
        </FormField>

        <FormField label="その他" error={form.formState.errors.other_amount}>
          <FormInput
            type="number"
            {...form.register('other_amount', { valueAsNumber: true })}
            placeholder="0"
          />
        </FormField>

        <FormField label="手数料" error={form.formState.errors.transaction_fee}>
          <FormInput
            type="number"
            {...form.register('transaction_fee', { valueAsNumber: true })}
            placeholder="0"
          />
        </FormField>
      </div>

      {/* 銀行情報 */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <FormField label="振出銀行" error={form.formState.errors.issuing_bank_name}>
          <FormInput
            type="text"
            {...form.register('issuing_bank_name')}
            placeholder="例: みずほ銀行 新宿支店"
          />
        </FormField>

        <FormField label="支払先銀行" error={form.formState.errors.payee_bank_name}>
          <FormInput
            type="text"
            {...form.register('payee_bank_name')}
            placeholder="例: 三菱UFJ銀行 渋谷支店"
          />
        </FormField>
      </div>

      {/* 差額警告 */}
      {difference !== 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠️ 支払対象金額と入力済み合計が一致していません。差額: ¥{Math.abs(difference).toLocaleString()}
        </div>
      )}
    </div>
  );
}
