import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import type { UserProfile, UserRole } from '../types';
import { useEffect } from 'react';

interface UserEditFormData {
  full_name: string;
  department: string;
  position: string;
  role: UserRole;
  is_active: boolean;
}

interface UserEditModalProps {
  user: UserProfile | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UserEditModal({ user, onClose, onSuccess }: UserEditModalProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<UserEditFormData>();

  // ユーザー情報が変更されたらフォームをリセット
  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name || '',
        department: user.department || '',
        position: user.position || '',
        role: user.role,
        is_active: user.is_active,
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: UserEditFormData) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: data.full_name,
          department: data.department || null,
          position: data.position || null,
          role: data.role,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('ユーザー情報を更新しました');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating user:', error);

      // エラーメッセージの解析
      let errorMessage = 'ユーザー情報の更新に失敗しました';

      if (error.message.includes('Cannot remove or deactivate the last administrator')) {
        errorMessage = '最後の管理者を無効化または削除することはできません';
      } else if (error.message.includes('permission denied')) {
        errorMessage = '権限がありません。管理者のみがユーザー情報を編集できます';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">ユーザー情報編集</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
          {/* メールアドレス（読み取り専用） */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={user.email}
              disabled
              className="w-full rounded-md border-gray-300 bg-gray-100 shadow-sm cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">
              ※ メールアドレスは変更できません
            </p>
          </div>

          {/* 氏名 */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="full_name"
              {...register('full_name', {
                required: '氏名は必須です',
                minLength: {
                  value: 2,
                  message: '氏名は2文字以上で入力してください',
                },
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="山田 太郎"
            />
            {errors.full_name && (
              <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
            )}
          </div>

          {/* 部署 */}
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
              部署
            </label>
            <input
              type="text"
              id="department"
              {...register('department')}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="営業部"
            />
          </div>

          {/* 役職 */}
          <div>
            <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
              役職
            </label>
            <input
              type="text"
              id="position"
              {...register('position')}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="課長"
            />
          </div>

          {/* ロール */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              ロール <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              {...register('role', { required: 'ロールは必須です' })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="staff">スタッフ</option>
              <option value="manager">マネージャー</option>
              <option value="admin">管理者</option>
            </select>
            {errors.role && (
              <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              ※ 管理者は全ての機能にアクセスできます。慎重に設定してください。
            </p>
          </div>

          {/* ステータス */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                {...register('is_active')}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">アカウントを有効にする</span>
            </label>
            <p className="mt-1 text-xs text-gray-500">
              ※ 無効化されたユーザーはログインできなくなります
            </p>
          </div>

          {/* ボタン */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? '更新中...' : '更新する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
