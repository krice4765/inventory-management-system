import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithRouter(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return <BrowserRouter>{children}</BrowserRouter>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Mock Supabase client for testing
 */
export const createMockSupabaseClient = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
});

/**
 * Wait for async operations to complete
 */
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Mock toast notifications
 */
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
};

/**
 * Create mock icon component
 */
export const createMockIcon = (name: string) => {
  const MockIcon = () => <svg data-testid={`icon-${name}`} />;
  MockIcon.displayName = name;
  return MockIcon;
};

// Re-export everything from testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
