import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Package, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom'; // 1. インポート

// 開発環境での管理者ログイン情報保持
const getDefaultLoginValues = () => {
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';

  if (isDevelopment) {
    // 開発環境: 管理者アカウントをローテーション
    const adminAccounts = [
      { email: 'Krice4765104@gmail.com', password: 'AdminPass123!' },
      { email: 'dev@inventory.test', password: 'password123' }
    ];

    // ローカルストレージから前回使用したアカウントを取得
    const lastUsedEmail = localStorage.getItem('dev_last_email');
    const account = adminAccounts.find(acc => acc.email === lastUsedEmail) || adminAccounts[0];

    return account;
  }

  // 本番環境: 空の状態
  return { email: '', password: '' };
};

const schema = yup.object({
  email: yup
    .string()
    .email('有効なメールアドレスを入力してください')
    .required('メールアドレスは必須です'),
  password: yup
    .string()
    .min(6, 'パスワードは6文字以上で入力してください')
    .required('パスワードは必須です'),
});

type LoginForm = yup.InferType<typeof schema>;

export const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth(); // 3. hasValidCredentials を削除
  const navigate = useNavigate(); // 1. useNavigateフックを使用

  const defaultValues = getDefaultLoginValues();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: yupResolver(schema),
    defaultValues: {
      email: defaultValues.email,
      password: defaultValues.password
    }
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        // 2. エラーハンドリングを修正
        toast.error('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
      } else {
        // 開発環境での管理者アカウント使用履歴を保存
        const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
        if (isDevelopment && (data.email === 'Krice4765104@gmail.com' || data.email === 'dev@inventory.test')) {
          localStorage.setItem('dev_last_email', data.email);
        }

        // 2. ログイン成功時はリダイレクト
        // 成功のtoastはuseAuth側で表示される
        navigate('/');
      }
    } catch {
      toast.error('ログイン中に予期せぬエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-indigo-100">
            <Package className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            在庫管理システム
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            アカウントにログインしてください
          </p>
        </div>
        
        {/* 3. デモユーザー情報の表示を削除 */}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレスを入力"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="パスワードを入力"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
