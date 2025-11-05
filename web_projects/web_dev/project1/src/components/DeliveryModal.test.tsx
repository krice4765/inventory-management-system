import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeliveryModal } from './DeliveryModal';
import * as deliveryModalStore from '../stores/deliveryModal.store';
import * as useOrderForDelivery from '../hooks/useOrderForDelivery';
import * as useOrderItemsForDelivery from '../hooks/useOrderItemsForDelivery';

// モックデータ
const mockOrderData = {
  purchase_order_id: 'order-123',
  order_no: 'PO-2025-001',
  partner_id: 'partner-123',
  partner_name: 'テスト仕入先',
  status: 'partial',
  ordered_amount: 150000,
  delivered_amount: 30000,
  remaining_amount: 120000,
};

const mockOrderItems = [
  {
    product_id: 'product-1',
    product_name: 'テスト商品A',
    quantity: 100,
    delivered_quantity: 30,
    remaining_quantity: 70,
    unit_price: 1000,
  },
  {
    product_id: 'product-2',
    product_name: 'テスト商品B',
    quantity: 50,
    delivered_quantity: 0,
    remaining_quantity: 50,
    unit_price: 2000,
  },
];

// Supabaseモック
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({ data: { delivery_sequence: 1 }, error: null })
                ),
              })),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

// useOrdersSyncモック
vi.mock('../hooks/useOrdersSync', () => ({
  useOrdersSync: () => ({
    syncOrderData: vi.fn(),
  }),
}));

describe('DeliveryModal', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // デフォルトのモック設定
    vi.spyOn(deliveryModalStore, 'useDeliveryModal').mockReturnValue({
      isOpen: true,
      selectedOrderId: 'order-123',
      open: vi.fn(),
      close: vi.fn(),
    });

    vi.spyOn(useOrderForDelivery, 'useOrderForDelivery').mockReturnValue({
      data: mockOrderData,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.spyOn(useOrderItemsForDelivery, 'useOrderItemsForDelivery').mockReturnValue({
      data: mockOrderItems,
      isLoading: false,
      isError: false,
      error: null,
    } as any);
  });

  const renderModal = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DeliveryModal />
      </QueryClientProvider>
    );
  };

  describe('レンダリング', () => {
    it('モーダルが開いているとき、発注情報を表示する', () => {
      renderModal();

      expect(screen.getByText('PO-2025-001')).toBeInTheDocument();
      expect(screen.getByText('テスト商品A')).toBeInTheDocument();
      expect(screen.getByText('テスト商品B')).toBeInTheDocument();
    });

    it('残数量が正しく表示される', () => {
      renderModal();

      // テーブル内で商品名と残数量を確認
      const table = screen.getByRole('table');
      expect(table).toHaveTextContent('テスト商品A');
      expect(table).toHaveTextContent('テスト商品B');
      // 残数列のセルを確認
      const cells = screen.getAllByRole('cell');
      const remainingCells = cells.filter(cell => cell.textContent === '70' || cell.textContent === '50');
      expect(remainingCells.length).toBeGreaterThanOrEqual(2);
    });

    it('ローディング中はスピナーを表示する', () => {
      vi.spyOn(useOrderForDelivery, 'useOrderForDelivery').mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      } as any);

      renderModal();

      expect(screen.getByText(/発注情報を読み込み中/)).toBeInTheDocument();
    });
  });

  describe('バリデーション', () => {
    it('残数量を超える入力時にエラーメッセージを表示する', async () => {
      const user = userEvent.setup();
      renderModal();

      const input = screen.getAllByRole('spinbutton')[0]; // 最初の数量入力
      await user.clear(input);
      await user.type(input, '80'); // 残数70を超える

      await waitFor(() => {
        expect(screen.getByText(/残数量70を超えています/)).toBeInTheDocument();
      });
    });

    it('負の数を入力時にエラーメッセージを表示する', async () => {
      const user = userEvent.setup();
      renderModal();

      const input = screen.getAllByRole('spinbutton')[0];
      await user.clear(input);
      await user.type(input, '-10');

      await waitFor(() => {
        expect(screen.getByText(/0以上の値を入力してください/)).toBeInTheDocument();
      });
    });

    it('全ての商品が0の場合は送信ボタンが無効になる', async () => {
      renderModal();

      // デフォルトは全て0なので、送信ボタンは無効
      const submitButton = screen.getByRole('button', { name: /納品登録/ });
      expect(submitButton).toBeDisabled();
    });

    it('数値以外を入力時にエラーメッセージを表示する', async () => {
      const user = userEvent.setup();
      renderModal();

      const input = screen.getAllByRole('spinbutton')[0];
      await user.clear(input);
      await user.type(input, 'abc');

      await waitFor(() => {
        expect(screen.getByText(/数値を入力してください/)).toBeInTheDocument();
      });
    });
  });

  describe('金額計算', () => {
    it('入力数量に応じて合計金額を計算する', async () => {
      const user = userEvent.setup();
      renderModal();

      const input1 = screen.getAllByRole('spinbutton')[0]; // 商品A: 単価1000
      const input2 = screen.getAllByRole('spinbutton')[1]; // 商品B: 単価2000

      // userEventで入力
      await user.clear(input1);
      await user.type(input1, '10'); // 10 * 1000 = 10,000

      await user.clear(input2);
      await user.type(input2, '5'); // 5 * 2000 = 10,000

      await waitFor(() => {
        // 合計: 20,000円（複数の要素がマッチする可能性があるためgetAllByTextを使用）
        const amounts = screen.getAllByText(/20,000/);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('数量が0の場合は金額に含めない', async () => {
      const user = userEvent.setup();
      renderModal();

      const input1 = screen.getAllByRole('spinbutton')[0]; // 商品A
      await user.clear(input1);
      await user.type(input1, '10'); // 10 * 1000 = 10,000

      // 商品Bは0のまま

      await waitFor(() => {
        expect(screen.getByText(/10,000/)).toBeInTheDocument();
      });
    });
  });

  describe('分納処理', () => {
    it('有効な数量入力時に送信ボタンが有効になる', async () => {
      const user = userEvent.setup();
      renderModal();

      // 初期状態では無効
      const submitButton = screen.getByRole('button', { name: /納品登録/ });
      expect(submitButton).toBeDisabled();

      // 数量を入力
      const input = screen.getAllByRole('spinbutton')[0];
      await user.clear(input);
      await user.type(input, '30'); // 有効な数量

      // ボタンが有効になることを確認
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('備考欄に200文字以内の入力ができる', async () => {
      renderModal();

      const memoInput = screen.getByPlaceholderText('備考を入力...');
      const validMemo = 'A'.repeat(200);

      // 直接値をセット
      fireEvent.change(memoInput, { target: { value: validMemo } });

      await waitFor(() => {
        expect(memoInput).toHaveValue(validMemo);
      });
    });

    it('備考欄が200文字を超える場合エラーを表示する', async () => {
      renderModal();

      const memoInput = screen.getByPlaceholderText('備考を入力...');
      const invalidMemo = 'A'.repeat(201);

      // 直接値をセット
      fireEvent.change(memoInput, { target: { value: invalidMemo } });

      await waitFor(() => {
        expect(screen.getByText(/備考は200文字以内で入力してください/)).toBeInTheDocument();
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('発注情報の取得エラー時にエラーメッセージを表示する', () => {
      vi.spyOn(useOrderForDelivery, 'useOrderForDelivery').mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('発注情報の取得に失敗しました'),
      } as any);

      renderModal();

      expect(screen.getByText(/発注情報の取得に失敗しました/)).toBeInTheDocument();
    });

    it('商品情報の取得エラー時にエラーメッセージを表示する', () => {
      vi.spyOn(useOrderItemsForDelivery, 'useOrderItemsForDelivery').mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('商品情報の取得に失敗しました'),
      } as any);

      renderModal();

      expect(screen.getByText(/商品情報の取得に失敗しました/)).toBeInTheDocument();
    });
  });

  describe('モーダル制御', () => {
    it('閉じるボタンでモーダルが閉じる', async () => {
      const user = userEvent.setup();
      const closeMock = vi.fn();

      vi.spyOn(deliveryModalStore, 'useDeliveryModal').mockReturnValue({
        isOpen: true,
        selectedOrderId: 'order-123',
        open: vi.fn(),
        close: closeMock,
      });

      renderModal();

      const closeButton = screen.getByRole('button', { name: /閉じる|キャンセル/ });
      await user.click(closeButton);

      expect(closeMock).toHaveBeenCalled();
    });

    it('モーダルが閉じているときは何も表示しない', () => {
      vi.spyOn(deliveryModalStore, 'useDeliveryModal').mockReturnValue({
        isOpen: false,
        selectedOrderId: null,
        open: vi.fn(),
        close: vi.fn(),
      });

      const { container } = renderModal();

      expect(container).toBeEmptyDOMElement();
    });
  });
});
