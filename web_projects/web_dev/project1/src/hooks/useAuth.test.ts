import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Supabaseモック
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

// react-hot-toastモック
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useAuth', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUnsubscribe = vi.fn();

    // デフォルトのモック設定
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: {
        subscription: {
          unsubscribe: mockUnsubscribe,
        },
      },
    } as any);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('初期化', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it('should fetch initial session on mount', async () => {
      const mockSession = {
        user: { id: 'user-1', email: 'test@example.com' },
        access_token: 'token',
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockSession.user);
    });

    it('should handle getSession error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('Session error'));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting initial session:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should set up auth state change listener', () => {
      renderHook(() => useAuth());

      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should clean up auth listener on unmount', () => {
      const { unmount } = renderHook(() => useAuth());

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('認証状態の変更', () => {
    it('should handle SIGNED_IN event', async () => {
      let authCallback: any;

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe,
            },
          },
        } as any;
      });

      const { result } = renderHook(() => useAuth());

      // authCallbackが設定されるのを待つ
      await waitFor(() => {
        expect(authCallback).toBeDefined();
      });

      const mockSession = {
        user: { id: 'user-1', email: 'test@example.com' },
        access_token: 'token',
      };

      // SIGNED_INイベントをトリガー
      await act(async () => {
        authCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(result.current.session).toEqual(mockSession);
      });

      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.loading).toBe(false);
      expect(toast.success).toHaveBeenCalledWith('ログインしました！');
    });

    it('should handle SIGNED_OUT event', async () => {
      let authCallback: any;

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe,
            },
          },
        } as any;
      });

      const { result } = renderHook(() => useAuth());

      // SIGNED_OUTイベントをトリガー
      await act(async () => {
        authCallback('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(result.current.session).toBeNull();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(toast.success).toHaveBeenCalledWith('ログアウトしました。');
    });

    it('should update state on session change', async () => {
      let authCallback: any;

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe,
            },
          },
        } as any;
      });

      const { result } = renderHook(() => useAuth());

      // authCallbackが設定されるのを待つ
      await waitFor(() => {
        expect(authCallback).toBeDefined();
      });

      const newSession = {
        user: { id: 'user-2', email: 'new@example.com' },
        access_token: 'new-token',
      };

      await act(async () => {
        authCallback('TOKEN_REFRESHED', newSession);
      });

      await waitFor(() => {
        expect(result.current.session).toEqual(newSession);
      });

      expect(result.current.user).toEqual(newSession.user);
    });
  });

  describe('signIn', () => {
    it('should call signInWithPassword with credentials', async () => {
      const mockResponse = {
        data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
        error: null,
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signIn('test@example.com', 'password123');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(response).toEqual(mockResponse);
    });

    it('should return error on failed sign in', async () => {
      const mockError = {
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(mockError as any);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signIn('test@example.com', 'wrong');

      expect(response.error).toBeDefined();
    });

    it('should be memoized with useCallback', () => {
      const { result, rerender } = renderHook(() => useAuth());

      const firstSignIn = result.current.signIn;
      rerender();
      const secondSignIn = result.current.signIn;

      expect(firstSignIn).toBe(secondSignIn);
    });
  });

  describe('signOut', () => {
    it('should call signOut', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should return error on failed sign out', async () => {
      const mockError = { error: { message: 'Sign out failed' } };

      vi.mocked(supabase.auth.signOut).mockResolvedValue(mockError as any);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signOut();

      expect(response.error).toBeDefined();
    });

    it('should be memoized with useCallback', () => {
      const { result, rerender } = renderHook(() => useAuth());

      const firstSignOut = result.current.signOut;
      rerender();
      const secondSignOut = result.current.signOut;

      expect(firstSignOut).toBe(secondSignOut);
    });
  });

  describe('signUp', () => {
    it('should call signUp with credentials', async () => {
      const mockResponse = {
        data: { user: { id: 'user-1' }, session: null },
        error: null,
      };

      vi.mocked(supabase.auth.signUp).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signUp('new@example.com', 'password123');

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
      });
      expect(response).toEqual(mockResponse);
    });

    it('should return error on failed sign up', async () => {
      const mockError = {
        data: { user: null, session: null },
        error: { message: 'User already exists' },
      };

      vi.mocked(supabase.auth.signUp).mockResolvedValue(mockError as any);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signUp('existing@example.com', 'password');

      expect(response.error).toBeDefined();
    });

    it('should be memoized with useCallback', () => {
      const { result, rerender } = renderHook(() => useAuth());

      const firstSignUp = result.current.signUp;
      rerender();
      const secondSignUp = result.current.signUp;

      expect(firstSignUp).toBe(secondSignUp);
    });
  });

  describe('resetPassword', () => {
    it('should call resetPasswordForEmail', async () => {
      const mockResponse = { data: {}, error: null };

      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.resetPassword('test@example.com');

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com');
      expect(response).toEqual(mockResponse);
    });

    it('should return error on failed password reset', async () => {
      const mockError = {
        data: {},
        error: { message: 'User not found' },
      };

      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue(mockError as any);

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.resetPassword('unknown@example.com');

      expect(response.error).toBeDefined();
    });

    it('should be memoized with useCallback', () => {
      const { result, rerender } = renderHook(() => useAuth());

      const firstResetPassword = result.current.resetPassword;
      rerender();
      const secondResetPassword = result.current.resetPassword;

      expect(firstResetPassword).toBe(secondResetPassword);
    });
  });

  describe('統合テスト', () => {
    it('should handle complete authentication flow', async () => {
      let authCallback: any;

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe,
            },
          },
        } as any;
      });

      const mockSession = {
        user: { id: 'user-1', email: 'test@example.com' },
        access_token: 'token',
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockSession.user, session: mockSession },
        error: null,
      } as any);

      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      // 初期状態
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.user).toBeNull();

      // サインイン
      await result.current.signIn('test@example.com', 'password');
      await act(async () => {
        authCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockSession.user);
      });

      // サインアウト
      await result.current.signOut();
      await act(async () => {
        authCallback('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });
    });
  });
});
