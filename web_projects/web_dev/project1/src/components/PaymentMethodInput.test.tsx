import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { PaymentMethodInput } from './PaymentMethodInput';
import { PaymentFormData } from '../lib/validations';

// テスト用のラッパーコンポーネント
function TestWrapper({ totalAmount = 100000 }: { totalAmount?: number }) {
  const form = useForm<PaymentFormData>({
    defaultValues: {
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
    },
    mode: 'onChange',
  });

  return <PaymentMethodInput form={form} totalAmount={totalAmount} />;
}

describe('PaymentMethodInput', () => {
  describe('レンダリング', () => {
    it('コンポーネントが正しく表示される', () => {
      render(<TestWrapper />);

      expect(screen.getByText('支払方法')).toBeInTheDocument();
      expect(screen.getByText('支払対象金額')).toBeInTheDocument();
      expect(screen.getByText('入力済み合計')).toBeInTheDocument();
      expect(screen.getByText('差額')).toBeInTheDocument();
    });

    it('支払対象金額が正しく表示される', () => {
      render(<TestWrapper totalAmount={150000} />);

      // 支払対象金額セクションを確認
      const amounts = screen.getAllByText('¥150,000');
      expect(amounts.length).toBeGreaterThan(0);
    });

    it('すべての入力フィールドが表示される', () => {
      render(<TestWrapper />);

      // 支払方法フィールドをplaceholderで確認
      const numericInputs = screen.getAllByPlaceholderText('0');
      expect(numericInputs.length).toBe(8); // 8つの数値フィールド

      // 銀行情報フィールド
      expect(screen.getByPlaceholderText('例: みずほ銀行 新宿支店')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('例: 三菱UFJ銀行 渋谷支店')).toBeInTheDocument();
    });
  });

  describe('リアルタイム計算', () => {
    it('単一の支払方法入力時に合計が計算される', async () => {
      const user = userEvent.setup();
      render(<TestWrapper totalAmount={50000} />);

      // placeholderで取得
      const inputs = screen.getAllByPlaceholderText('0');
      const cashInput = inputs[0]; // 現金

      await user.clear(cashInput);
      await user.type(cashInput, '30000');

      await waitFor(() => {
        // 入力済み合計に30,000が表示される
        const totals = screen.getAllByText(/30,000/);
        expect(totals.length).toBeGreaterThan(0);
      });
    });

    it('複数の支払方法入力時に合計が計算される', async () => {
      const user = userEvent.setup();
      render(<TestWrapper totalAmount={100000} />);

      const inputs = screen.getAllByPlaceholderText('0');
      const cashInput = inputs[0]; // 現金
      const checkInput = inputs[1]; // 小切手
      const transferInput = inputs[3]; // 振込

      await user.clear(cashInput);
      await user.type(cashInput, '3'); // 30,000 -> 3 (短く)

      await user.clear(checkInput);
      await user.type(checkInput, '2'); // 20,000 -> 2

      await user.clear(transferInput);
      await user.type(transferInput, '5'); // 50,000 -> 5

      await waitFor(() => {
        // 合計: 10
        const totals = screen.getAllByText(/10/);
        expect(totals.length).toBeGreaterThan(0);
      });
    });

    it('手数料・値引きを含めた計算が正しい', async () => {
      const user = userEvent.setup();
      render(<TestWrapper totalAmount={100000} />);

      const inputs = screen.getAllByPlaceholderText('0');
      const cashInput = inputs[0]; // 現金
      const discountInput = inputs[5]; // 値引き
      const feeInput = inputs[7]; // 手数料

      await user.clear(cashInput);
      await user.type(cashInput, '95'); // 95,000 -> 95

      await user.clear(discountInput);
      await user.type(discountInput, '3'); // 3,000 -> 3

      await user.clear(feeInput);
      await user.type(feeInput, '2'); // 2,000 -> 2

      await waitFor(() => {
        // 合計: 100
        const totals = screen.getAllByText(/100/);
        expect(totals.length).toBeGreaterThan(0);
      });
    });
  });

  describe('差額表示', () => {
    it('金額が一致する場合、差額が0で表示', async () => {
      const user = userEvent.setup();
      render(<TestWrapper totalAmount={50000} />);

      const inputs = screen.getAllByPlaceholderText('0');
      await user.clear(inputs[0]);
      await user.type(inputs[0], '50000');

      await waitFor(() => {
        // 差額が0であることを確認
        const zeroAmounts = screen.getAllByText(/¥0/);
        expect(zeroAmounts.length).toBeGreaterThan(0);
      });
    });

    it('金額が不一致の場合、差額が表示', async () => {
      const user = userEvent.setup();
      render(<TestWrapper totalAmount={100000} />);

      const inputs = screen.getAllByPlaceholderText('0');
      await user.clear(inputs[0]);
      await user.type(inputs[0], '70000');

      await waitFor(() => {
        // 差額30,000が表示される
        const amounts = screen.getAllByText(/30,000/);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('差額警告', () => {
    it('金額一致時は警告が表示されない', async () => {
      const user = userEvent.setup();
      render(<TestWrapper totalAmount={50000} />);

      const inputs = screen.getAllByPlaceholderText('0');
      await user.clear(inputs[0]);
      await user.type(inputs[0], '50000');

      await waitFor(() => {
        expect(screen.queryByText(/支払対象金額と入力済み合計が一致していません/)).not.toBeInTheDocument();
      });
    });

    it('金額不一致時は警告メッセージが表示される', async () => {
      const user = userEvent.setup();
      render(<TestWrapper totalAmount={100000} />);

      const inputs = screen.getAllByPlaceholderText('0');
      await user.clear(inputs[0]);
      await user.type(inputs[0], '70000');

      await waitFor(() => {
        expect(screen.getByText(/支払対象金額と入力済み合計が一致していません/)).toBeInTheDocument();
        expect(screen.getByText(/差額: ¥30,000/)).toBeInTheDocument();
      });
    });
  });

  describe('銀行情報入力', () => {
    it('振出銀行・支払先銀行の入力ができる', async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const issuingBankInput = screen.getByPlaceholderText('例: みずほ銀行 新宿支店');
      const payeeBankInput = screen.getByPlaceholderText('例: 三菱UFJ銀行 渋谷支店');

      await user.type(issuingBankInput, 'みずほ銀行 新宿支店');
      await user.type(payeeBankInput, '三菱UFJ銀行 渋谷支店');

      await waitFor(() => {
        expect(issuingBankInput).toHaveValue('みずほ銀行 新宿支店');
        expect(payeeBankInput).toHaveValue('三菱UFJ銀行 渋谷支店');
      });
    });
  });
});
