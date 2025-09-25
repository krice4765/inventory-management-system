import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAllMovements, useInventoryStats } from '../useOptimizedInventory'

// Supabaseのモック
const createMockQuery = () => {
  const mockMethods = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: vi.fn()
  }

  // チェーンを可能にするため、各メソッドはthisを返す
  Object.keys(mockMethods).forEach(key => {
    if (key !== 'then') {
      mockMethods[key].mockReturnValue(mockMethods)
    }
  })

  // thenメソッドはPromiseの結果を返す
  mockMethods.then.mockResolvedValue({
    data: [
      {
        id: '1',
        product_id: 'prod1',
        movement_type: 'in',
        quantity: 10,
        total_amount: 1000,
        created_at: '2024-01-01T00:00:00Z',
        products: {
          id: 'prod1',
          product_name: 'テスト商品',
          product_code: 'TEST001',
          current_stock: 10
        }
      }
    ],
    error: null
  })

  return mockMethods
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => createMockQuery())
  }))
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
    },
  },
})

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient()
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children
  )
}

describe('useOptimizedInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useAllMovements', () => {
    it('フックが初期化される', () => {
      const { result } = renderHook(() => useAllMovements({}), { wrapper })

      // 初期状態の確認
      expect(result.current).toBeDefined()
      expect(typeof result.current.isLoading).toBe('boolean')
    })

    it('フィルタ付きで初期化される', () => {
      const { result } = renderHook(() => useAllMovements({
        searchTerm: 'テスト',
        movementType: 'in'
      }), { wrapper })

      expect(result.current).toBeDefined()
      expect(typeof result.current.isLoading).toBe('boolean')
    })
  })

  describe('useInventoryStats', () => {
    it('統計フックが初期化される', () => {
      const { result } = renderHook(() => useInventoryStats({}), { wrapper })

      expect(result.current).toBeDefined()
      expect(typeof result.current.isLoading).toBe('boolean')
    })
  })
})