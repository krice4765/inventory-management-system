import { useState } from 'react';
import { X, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userName: string;
}

export default function PasswordResetModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  userName,
}: PasswordResetModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (newPassword.length < 8) {
      toast.error('パスワードは8文字以上にしてください');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('パスワードが一致しません');
      return;
    }

    setIsSubmitting(true);

    try {
      // Edge Functionを呼び出してパスワードをリセット
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('認証セッションが見つかりません');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            newPassword,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'パスワードのリセットに失敗しました');
      }

      toast.success(`${userName || userEmail}のパスワードをリセットしました`);
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'パスワードのリセットに失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-semibold">パスワードリセット</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">
            <span className="font-medium">ユーザー:</span> {userName || '未設定'}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">メール:</span> {userEmail}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新しいパスワード <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="8文字以上"
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              8文字以上で設定してください
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード確認 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="もう一度入力"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'リセット中...' : 'パスワードリセット'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
