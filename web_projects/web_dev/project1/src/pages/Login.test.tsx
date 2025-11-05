import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display page title', () => {
      renderComponent();
      expect(screen.getByText('在庫管理システム')).toBeInTheDocument();
    });

    it('should display subtitle', () => {
      renderComponent();
      expect(screen.getByText('アカウントにサインイン')).toBeInTheDocument();
    });

    it('should display email input', () => {
      renderComponent();
      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
    });

    it('should display password input', () => {
      renderComponent();
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    });

    it('should display sign in button', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: 'サインイン' })).toBeInTheDocument();
    });

    it('should display forgot password link', () => {
      renderComponent();
      expect(screen.getByText('パスワードを忘れた方')).toBeInTheDocument();
    });

    it('should have email input with correct type', () => {
      renderComponent();
      const emailInput = screen.getByLabelText('メールアドレス') as HTMLInputElement;
      expect(emailInput.type).toBe('email');
    });

    it('should have password input with correct type', () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement;
      expect(passwordInput.type).toBe('password');
    });

    it('should have required email input', () => {
      renderComponent();
      const emailInput = screen.getByLabelText('メールアドレス') as HTMLInputElement;
      expect(emailInput.required).toBe(true);
    });

    it('should have required password input', () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement;
      expect(passwordInput.required).toBe(true);
    });
  });

  describe('Form Input', () => {
    it('should update email input value', () => {
      renderComponent();
      const emailInput = screen.getByLabelText('メールアドレス') as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      expect(emailInput.value).toBe('test@example.com');
    });

    it('should update password input value', () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement;

      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(passwordInput.value).toBe('password123');
    });

    it('should handle empty email input', () => {
      renderComponent();
      const emailInput = screen.getByLabelText('メールアドレス') as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: '' } });

      expect(emailInput.value).toBe('');
    });

    it('should handle empty password input', () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement;

      fireEvent.change(passwordInput, { target: { value: '' } });

      expect(passwordInput.value).toBe('');
    });

    it('should update both inputs independently', () => {
      renderComponent();
      const emailInput = screen.getByLabelText('メールアドレス') as HTMLInputElement;
      const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });

      expect(emailInput.value).toBe('user@example.com');
      expect(passwordInput.value).toBe('mypassword');
    });
  });

  describe('Successful Login', () => {
    it('should call signInWithPassword with correct credentials', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: { id: 'user-1' }, session: {} },
        error: null,
      } as any);

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('should display success toast on successful login', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: { id: 'user-1' }, session: {} },
        error: null,
      } as any);

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('ログインしました');
      });
    });

    it('should show loading state during login', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'サインイン中...' })).toBeInTheDocument();
      });
    });

    it('should disable button during login', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: 'サインイン中...' }) as HTMLButtonElement;
        expect(loadingButton.disabled).toBe(true);
      });
    });
  });

  describe('Failed Login', () => {
    it('should display error toast on login failure with error message', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', name: 'AuthError', status: 400 },
      } as any);

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid login credentials');
      });
    });

    it('should display error toast on network failure', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockRejectedValue(
        new Error('Network error')
      );

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('ログインに失敗しました');
      });
    });

    it('should re-enable button after failed login', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials', name: 'AuthError', status: 400 },
      } as any);

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      const button = screen.getByRole('button', { name: 'サインイン' }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it('should allow retry after failed login', async () => {
      vi.mocked(supabase.auth.signInWithPassword)
        .mockResolvedValueOnce({
          data: { user: null, session: null },
          error: { message: 'Invalid credentials', name: 'AuthError', status: 400 },
        } as any)
        .mockResolvedValueOnce({
          data: { user: { id: 'user-1' }, session: {} },
          error: null,
        } as any);

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      // First attempt - fail
      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Second attempt - success
      fireEvent.change(emailInput, { target: { value: 'correct@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'correctpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('ログインしました');
      });
    });
  });

  describe('Navigation', () => {
    it('should have forgot password link with correct path', () => {
      renderComponent();
      const forgotPasswordLink = screen.getByText('パスワードを忘れた方');
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
    });

    it('should render forgot password link as anchor element', () => {
      renderComponent();
      const forgotPasswordLink = screen.getByText('パスワードを忘れた方');
      expect(forgotPasswordLink.tagName).toBe('A');
    });
  });

  describe('Form Validation', () => {
    it('should not submit form with empty fields', async () => {
      renderComponent();

      const submitButton = screen.getByRole('button', { name: 'サインイン' });
      fireEvent.click(submitButton);

      // HTML5 validation should prevent submission
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('should have autocomplete attribute on email input', () => {
      renderComponent();
      const emailInput = screen.getByLabelText('メールアドレス') as HTMLInputElement;
      expect(emailInput.autocomplete).toBe('email');
    });

    it('should have autocomplete attribute on password input', () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement;
      expect(passwordInput.autocomplete).toBe('current-password');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid multiple clicks on submit button', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: { id: 'user-1' }, session: {} },
        error: null,
      } as any);

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      // Click multiple times
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });

      // Should only call once due to loading state
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    });

    it('should handle special characters in email', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: { id: 'user-1' }, session: {} },
        error: null,
      } as any);

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'test+alias@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test+alias@example.com',
          password: 'password123',
        });
      });
    });

    it('should handle special characters in password', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: { id: 'user-1' }, session: {} },
        error: null,
      } as any);

      renderComponent();

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'サインイン' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'P@ssw0rd!#$%' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'P@ssw0rd!#$%',
        });
      });
    });
  });
});
