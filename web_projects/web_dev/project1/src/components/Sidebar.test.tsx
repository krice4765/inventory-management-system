import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Mocks
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('Sidebar', () => {
  const mockSetUser = vi.fn();

  const defaultUser = {
    id: 'user-1',
    email: 'test@example.com',
  };

  const defaultUserProfile = {
    full_name: 'テストユーザー',
    role: 'staff' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      user: defaultUser,
      userProfile: defaultUserProfile,
      setUser: mockSetUser,
    } as any);
  });

  const renderSidebar = (initialRoute = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Sidebar />
      </MemoryRouter>
    );
  };

  describe('基本表示', () => {
    it('should render sidebar with header', () => {
      renderSidebar();

      expect(screen.getByText('在庫管理システム')).toBeInTheDocument();
    });

    it('should display user information with full name', () => {
      renderSidebar();

      expect(screen.getByText('テストユーザー')).toBeInTheDocument();
      expect(screen.getByText('スタッフ')).toBeInTheDocument();
    });

    it('should display email when full name is not available', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: defaultUser,
        userProfile: { ...defaultUserProfile, full_name: undefined },
        setUser: mockSetUser,
      } as any);

      renderSidebar();

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should display user avatar with first letter of name', () => {
      renderSidebar();

      const avatar = screen.getByText('テ'); // First letter of "テストユーザー"
      expect(avatar).toBeInTheDocument();
    });

    it('should render logout button', () => {
      renderSidebar();

      expect(screen.getByText('ログアウト')).toBeInTheDocument();
    });
  });

  describe('ナビゲーション構造', () => {
    it('should render dashboard link', () => {
      renderSidebar();

      expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
    });

    it('should render inventory section', () => {
      renderSidebar();

      expect(screen.getByText('在庫・商品管理')).toBeInTheDocument();
    });

    it('should render partners section', () => {
      renderSidebar();

      expect(screen.getByText('取引先・受発注')).toBeInTheDocument();
    });

    it('should render payable section', () => {
      renderSidebar();

      expect(screen.getByText('買掛金管理')).toBeInTheDocument();
    });

    it('should render receivable section', () => {
      renderSidebar();

      expect(screen.getByText('売掛金管理')).toBeInTheDocument();
    });

    it('should render reports section', () => {
      renderSidebar();

      expect(screen.getByText('レポート')).toBeInTheDocument();
    });
  });

  describe('セクション開閉', () => {
    it('should toggle inventory section on click', () => {
      renderSidebar();

      // 初期状態では在庫管理セクションは開いている
      expect(screen.getByText('商品管理')).toBeInTheDocument();

      // セクションをクリックして閉じる
      const inventoryButton = screen.getByText('在庫・商品管理');
      fireEvent.click(inventoryButton);

      // サブメニューが非表示になる
      expect(screen.queryByText('商品管理')).not.toBeInTheDocument();

      // 再度クリックして開く
      fireEvent.click(inventoryButton);
      expect(screen.getByText('商品管理')).toBeInTheDocument();
    });

    it('should toggle partners section on click', () => {
      renderSidebar();

      const partnersButton = screen.getByText('取引先・受発注');

      // 初期状態では閉じている
      expect(screen.queryByText('取引先管理')).not.toBeInTheDocument();

      // クリックして開く
      fireEvent.click(partnersButton);
      expect(screen.getByText('取引先管理')).toBeInTheDocument();
      expect(screen.getByText('発注管理')).toBeInTheDocument();
    });

    it('should toggle reports section on click', () => {
      renderSidebar();

      const reportsButton = screen.getByText('レポート');

      // 初期状態では閉じている
      expect(screen.queryByText('買掛金残高レポート')).not.toBeInTheDocument();

      // クリックして開く
      fireEvent.click(reportsButton);
      expect(screen.getByText('買掛金残高レポート')).toBeInTheDocument();
      expect(screen.getByText('在庫状況レポート')).toBeInTheDocument();
    });
  });

  describe('アクティブ状態', () => {
    it('should highlight active dashboard link', () => {
      renderSidebar('/');

      const dashboardLink = screen.getByText('ダッシュボード').closest('a');
      expect(dashboardLink).toHaveClass('bg-blue-600');
    });

    it('should highlight active products link', () => {
      renderSidebar('/products');

      const productsLink = screen.getByText('商品管理').closest('a');
      expect(productsLink).toHaveClass('bg-blue-600');
    });

    it('should highlight parent section when child is active', () => {
      renderSidebar('/products');

      const inventorySection = screen.getByText('在庫・商品管理').closest('button');
      expect(inventorySection).toHaveClass('bg-gray-700');
    });

    it('should handle orders path with sub-routes', () => {
      renderSidebar('/orders/new');

      // 取引先・受発注セクションを開く
      fireEvent.click(screen.getByText('取引先・受発注'));

      const ordersLink = screen.getByText('発注管理').closest('a');
      expect(ordersLink).toHaveClass('bg-blue-600');
    });

    it('should handle sales-orders path with sub-routes', () => {
      renderSidebar('/sales-orders/123');

      // 取引先・受発注セクションを開く
      fireEvent.click(screen.getByText('取引先・受発注'));

      const salesOrdersLink = screen.getByText('受注管理').closest('a');
      expect(salesOrdersLink).toHaveClass('bg-blue-600');
    });
  });

  describe('役割ベースの表示', () => {
    it('should not show admin menu for staff user', () => {
      renderSidebar();

      expect(screen.queryByText('管理者メニュー')).not.toBeInTheDocument();
    });

    it('should not show admin menu for manager user', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: defaultUser,
        userProfile: { ...defaultUserProfile, role: 'manager' },
        setUser: mockSetUser,
      } as any);

      renderSidebar();

      expect(screen.queryByText('管理者メニュー')).not.toBeInTheDocument();
      expect(screen.getByText('マネージャー')).toBeInTheDocument();
    });

    it('should show admin menu for admin user', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: defaultUser,
        userProfile: { ...defaultUserProfile, role: 'admin' },
        setUser: mockSetUser,
      } as any);

      renderSidebar();

      expect(screen.getByText('管理者メニュー')).toBeInTheDocument();
      expect(screen.getByText('管理者')).toBeInTheDocument();
    });

    it('should toggle admin section for admin user', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: defaultUser,
        userProfile: { ...defaultUserProfile, role: 'admin' },
        setUser: mockSetUser,
      } as any);

      renderSidebar();

      const adminButton = screen.getByText('管理者メニュー');

      // 初期状態では閉じている
      expect(screen.queryByText('ユーザー管理')).not.toBeInTheDocument();

      // クリックして開く
      fireEvent.click(adminButton);
      expect(screen.getByText('ユーザー管理')).toBeInTheDocument();
      expect(screen.getByText('会社設定')).toBeInTheDocument();
    });

    it('should highlight admin section when admin page is active', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: defaultUser,
        userProfile: { ...defaultUserProfile, role: 'admin' },
        setUser: mockSetUser,
      } as any);

      renderSidebar('/admin/users');

      const adminButton = screen.getByText('管理者メニュー').closest('button');
      expect(adminButton).toHaveClass('bg-gray-700');

      // セクションを開く
      fireEvent.click(screen.getByText('管理者メニュー'));

      const usersLink = screen.getByText('ユーザー管理').closest('a');
      expect(usersLink).toHaveClass('bg-blue-600');
    });
  });

  describe('ログアウト機能', () => {
    it('should call signOut and setUser on logout', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      renderSidebar();

      const logoutButton = screen.getByText('ログアウト');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(supabase.auth.signOut).toHaveBeenCalled();
      });

      expect(mockSetUser).toHaveBeenCalledWith(null);
      expect(toast.success).toHaveBeenCalledWith('ログアウトしました');
    });

    it('should handle logout error', async () => {
      const mockError = { message: 'Sign out failed' };
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: mockError as any });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderSidebar();

      const logoutButton = screen.getByText('ログアウト');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('ログアウトに失敗しました');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Logout error:', mockError);
      expect(mockSetUser).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle logout exception', async () => {
      const mockError = new Error('Network error');
      vi.mocked(supabase.auth.signOut).mockRejectedValue(mockError);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderSidebar();

      const logoutButton = screen.getByText('ログアウト');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('ログアウトに失敗しました');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Logout error:', mockError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('ユーザーアバター表示', () => {
    it('should show first letter of email when no name available', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: { ...defaultUser, email: 'alice@example.com' },
        userProfile: { role: 'staff' },
        setUser: mockSetUser,
      } as any);

      renderSidebar();

      expect(screen.getByText('A')).toBeInTheDocument(); // First letter of email
    });

    it('should prioritize full name over email for avatar', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: { ...defaultUser, email: 'alice@example.com' },
        userProfile: { full_name: 'Bob Smith', role: 'staff' },
        setUser: mockSetUser,
      } as any);

      renderSidebar();

      expect(screen.getByText('B')).toBeInTheDocument(); // First letter of full_name
      expect(screen.queryByText('A')).not.toBeInTheDocument();
    });
  });
});
