import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from './AdminRoute';
import { useAuthStore } from '../stores/authStore';
import type { UserProfile } from '../types';

// Mock the auth store
vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('AdminRoute', () => {
  const mockUseAuthStore = vi.mocked(useAuthStore);

  const renderWithRouter = (component: React.ReactElement, initialPath = '/admin') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<div>Dashboard Page</div>} />
          <Route path="/admin" element={component} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading spinner when loading is true', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        userProfile: null,
        loading: true,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not display children when loading', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        userProfile: null,
        loading: true,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });
  });

  describe('Admin Access', () => {
    it('should display children when user has admin role', () => {
      const mockAdminProfile: UserProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        full_name: 'Admin User',
        role: 'admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockUseAuthStore.mockReturnValue({
        user: {
          id: 'user-1',
          email: 'admin@example.com',
        } as any,
        userProfile: mockAdminProfile,
        loading: false,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });

    it('should not display loading spinner when admin is authenticated', () => {
      const mockAdminProfile: UserProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        full_name: 'Admin User',
        role: 'admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockUseAuthStore.mockReturnValue({
        user: {
          id: 'user-1',
          email: 'admin@example.com',
        } as any,
        userProfile: mockAdminProfile,
        loading: false,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('Non-Admin Access', () => {
    it('should redirect to dashboard when user has user role', () => {
      const mockUserProfile: UserProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        full_name: 'Regular User',
        role: 'user',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockUseAuthStore.mockReturnValue({
        user: {
          id: 'user-1',
          email: 'user@example.com',
        } as any,
        userProfile: mockUserProfile,
        loading: false,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });

    it('should redirect to dashboard when userProfile is null', () => {
      mockUseAuthStore.mockReturnValue({
        user: {
          id: 'user-1',
          email: 'user@example.com',
        } as any,
        userProfile: null,
        loading: false,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });

    it('should redirect to dashboard when userProfile is undefined', () => {
      mockUseAuthStore.mockReturnValue({
        user: {
          id: 'user-1',
          email: 'user@example.com',
        } as any,
        userProfile: undefined as any,
        loading: false,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });

    it('should not display admin content when user has incorrect role', () => {
      const mockUserProfile: UserProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        full_name: 'Regular User',
        role: 'user',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockUseAuthStore.mockReturnValue({
        user: {
          id: 'user-1',
          email: 'user@example.com',
        } as any,
        userProfile: mockUserProfile,
        loading: false,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user but present admin profile', () => {
      const mockAdminProfile: UserProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        full_name: 'Admin User',
        role: 'admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockUseAuthStore.mockReturnValue({
        user: null,
        userProfile: mockAdminProfile,
        loading: false,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      // Should still allow access if userProfile has admin role
      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });

    it('should handle complex children components', () => {
      const mockAdminProfile: UserProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        full_name: 'Admin User',
        role: 'admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockUseAuthStore.mockReturnValue({
        user: {
          id: 'user-1',
          email: 'admin@example.com',
        } as any,
        userProfile: mockAdminProfile,
        loading: false,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      renderWithRouter(
        <AdminRoute>
          <div>
            <h1>Admin Panel</h1>
            <p>Manage users and settings</p>
            <button>Save Changes</button>
          </div>
        </AdminRoute>
      );

      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
      expect(screen.getByText('Manage users and settings')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });

    it('should preserve children when re-rendered with same admin profile', () => {
      const mockAdminProfile: UserProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        full_name: 'Admin User',
        role: 'admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockUseAuthStore.mockReturnValue({
        user: {
          id: 'user-1',
          email: 'admin@example.com',
        } as any,
        userProfile: mockAdminProfile,
        loading: false,
        setUser: vi.fn(),
        setUserProfile: vi.fn(),
        setLoading: vi.fn(),
      });

      const { rerender } = renderWithRouter(
        <AdminRoute>
          <div>Admin Content</div>
        </AdminRoute>
      );

      expect(screen.getByText('Admin Content')).toBeInTheDocument();

      // Re-render with same props
      rerender(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/" element={<div>Dashboard Page</div>} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <div>Admin Content</div>
                </AdminRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });
  });
});
