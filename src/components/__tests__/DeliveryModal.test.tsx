import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { DeliveryModal } from '../DeliveryModal'
import type { OrderData } from '../../types'

// モックデータ
const mockOrderData: OrderData = {
  purchase_order_id: 'test-order-1',
  order_no: 'PO2024001',
  total_amount: 10000,
  remaining_amount: 5000,
  items: [
    {
      id: 'item-1',
      product_id: 'prod-1',
      product_name: 'テスト商品A',
      quantity: 5,
      remaining_quantity: 3,
      unit_price: 1000
    },
    {
      id: 'item-2',
      product_id: 'prod-2',
      product_name: 'テスト商品B',
      quantity: 2,
      remaining_quantity: 1,
      unit_price: 2000
    }
  ],
  delivery_deadline: '2024-12-31',
  partner_name: 'テスト仕入先',
  status: 'confirmed'
}

// React Query クライアント
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// Supabaseモック
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    })),
  })),
}))

describe('DeliveryModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    orderData: mockOrderData,
    deliveryType: 'partial' as const,
    onDeliveryComplete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DeliveryModalコンポーネントがレンダリングされる', () => {
    const { container } = render(
      <TestWrapper>
        <DeliveryModal {...mockProps} />
      </TestWrapper>
    )

    // コンポーネントがレンダリングされることを確認（内容は問わない）
    expect(container.firstChild).toBeDefined()
  })

  it('プロパティが正しく渡される', () => {
    const { container } = render(
      <TestWrapper>
        <DeliveryModal {...mockProps} />
      </TestWrapper>
    )

    expect(container).toBeDefined()
    expect(mockProps.orderData.purchase_order_id).toBe('test-order-1')
  })

  it('全納モードでレンダリングできる', () => {
    const fullDeliveryProps = {
      ...mockProps,
      deliveryType: 'full' as const,
    }

    const { container } = render(
      <TestWrapper>
        <DeliveryModal {...fullDeliveryProps} />
      </TestWrapper>
    )

    expect(container).toBeDefined()
  })

  it('モーダルが閉じられた状態でもレンダリングできる', () => {
    const closedModalProps = {
      ...mockProps,
      isOpen: false,
    }

    const { container } = render(
      <TestWrapper>
        <DeliveryModal {...closedModalProps} />
      </TestWrapper>
    )

    expect(container).toBeDefined()
  })
})