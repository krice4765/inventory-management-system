import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Eye, EyeOff, RefreshCw, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import type { UserRole } from '../types';

interface UserInviteFormData {
  email: string;
  password: string;
  full_name: string;
  department: string;
  position: string;
  role: UserRole;
}

interface UserInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface GeneratedCredentials {
  email: string;
  password: string;
}

export default function UserInviteModal({ isOpen, onClose, onSuccess }: UserInviteModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<GeneratedCredentials | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<UserInviteFormData>({
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      department: '',
      position: '',
      role: 'staff',
    },
  });

  const passwordValue = watch('password');

  // 安全なパスワードを生成（12文字、大文字小文字数字記号含む）
  const generatePassword = () => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = lowercase + uppercase + numbers + symbols;

    let password = '';
    // 各カテゴリから最低1文字ずつ
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // 残り8文字をランダムに
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // シャッフル
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    return password;
  };

  const handleGeneratePassword = () => {
    const pwd = generatePassword();
    setValue('password', pwd);
    toast.success('パスワードを生成しました');
  };

  const handlePrintCredentials = () => {
    if (!generatedCredentials) return;

    const printWindow = window.open('', '', 'width=600,height=400');
    if (!printWindow) {
      toast.error('印刷ウィンドウを開けませんでした');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ユーザー認証情報</title>
          <style>
            body {
              font-family: 'Hiragino Sans', 'Meiryo', sans-serif;
              padding: 40px;
              max-width: 600px;
              margin: 0 auto;
            }
            h1 {
              color: #1f2937;
              border-bottom: 3px solid #3b82f6;
              padding-bottom: 10px;
              margin-bottom: 30px;
            }
            .credentials {
              border: 2px solid #3b82f6;
              border-radius: 8px;
              padding: 30px;
              margin: 30px 0;
              background-color: #f9fafb;
            }
            .field {
              margin: 20px 0;
              display: flex;
              align-items: baseline;
            }
            .label {
              font-weight: bold;
              min-width: 140px;
              color: #374151;
            }
            .value {
              font-size: 18px;
              color: #111827;
              font-family: monospace;
              background-color: #fff;
              padding: 5px 10px;
              border-radius: 4px;
              border: 1px solid #d1d5db;
            }
            .note {
              margin-top: 30px;
              padding: 15px;
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              color: #92400e;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>在庫管理システム - ユーザー認証情報</h1>

          <div class="credentials">
            <div class="field">
              <span class="label">メールアドレス:</span>
              <span class="value">${generatedCredentials.email}</span>
            </div>
            <div class="field">
              <span class="label">パスワード:</span>
              <span class="value">${generatedCredentials.password}</span>
            </div>
          </div>

          <div class="note">
            <strong>重要:</strong> セキュリティのため、初回ログイン後は必ずパスワードを変更してください。
          </div>

          <div class="footer">
            発行日: ${new Date().toLocaleDateString('ja-JP')} ${new Date().toLocaleTimeString('ja-JP')}<br>
            このドキュメントは機密情報を含みます。安全に管理してください。
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const onSubmit = async (data: UserInviteFormData) => {
    try {
      // Get current session token
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('認証セッションが見つかりません');
      }

      // Call Edge Function to create user
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            full_name: data.full_name,
            department: data.department || null,
            position: data.position || null,
            role: data.role,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ユーザーの作成に失敗しました');
      }

      // Store credentials for printing
      setGeneratedCredentials({
        email: result.email,
        password: result.password,
      });

      toast.success('ユーザーを作成しました');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating user:', error);

      let errorMessage = 'ユーザーの作成に失敗しました';

      if (error.message.includes('Only administrators')) {
        errorMessage = '管理者のみがユーザーを作成できます';
      } else if (error.message.includes('duplicate') || error.message.includes('already exists')) {
        errorMessage = 'このメールアドレスは既に登録されています';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    }
  };

  const handleClose = () => {
    reset();
    setGeneratedCredentials(null);
    setShowPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">ユーザー作成</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 認証情報表示エリア */}
        {generatedCredentials && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-md p-4">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              ユーザーが作成されました
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start">
                <span className="font-medium text-green-800 min-w-[100px]">メール:</span>
                <span className="text-green-900 break-all">{generatedCredentials.email}</span>
              </div>
              <div className="flex items-start">
                <span className="font-medium text-green-800 min-w-[100px]">パスワード:</span>
                <span className="text-green-900 font-mono">{generatedCredentials.password}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePrintCredentials}
              className="mt-3 w-full flex items-center justify-center px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Printer className="w-4 h-4 mr-2" />
              認証情報を印刷
            </button>
            <p className="mt-2 text-xs text-green-700">
              ※ この情報をユーザーに安全に共有してください
            </p>
          </div>
        )}

        {/* フォーム */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
          {/* メールアドレス */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              {...register('email', {
                required: 'メールアドレスは必須です',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: '有効なメールアドレスを入力してください',
                },
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="user@example.com"
              disabled={!!generatedCredentials}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* パスワード */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              パスワード <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  {...register('password', {
                    required: 'パスワードは必須です',
                    minLength: {
                      value: 8,
                      message: 'パスワードは8文字以上で入力してください',
                    },
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
                  placeholder="パスワードを入力"
                  disabled={!!generatedCredentials}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={!!generatedCredentials}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!!generatedCredentials}
                title="安全なパスワードを自動生成"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                自動生成
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              ※ 最低8文字、英数字と記号を含めることを推奨
            </p>
            {passwordValue && passwordValue.length >= 8 && (
              <div className="mt-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">強度:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{12,}$/.test(passwordValue)
                          ? 'bg-green-500 w-full'
                          : /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(passwordValue)
                          ? 'bg-yellow-500 w-2/3'
                          : 'bg-red-500 w-1/3'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}
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
              disabled={!!generatedCredentials}
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
              disabled={!!generatedCredentials}
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
              disabled={!!generatedCredentials}
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
              disabled={!!generatedCredentials}
            >
              <option value="staff">一般スタッフ</option>
              <option value="purchasing_staff">発注担当者</option>
              <option value="inventory_staff">在庫管理担当者</option>
              <option value="sales_staff">営業担当者</option>
              <option value="accounting_staff">経理担当者</option>
              <option value="manager">部門管理者</option>
              <option value="admin">システム管理者</option>
              <option value="readonly">閲覧専用</option>
            </select>
            {errors.role && (
              <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              ※ 管理者は全ての機能にアクセスできます。慎重に設定してください。
            </p>
          </div>

          {/* ボタン */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {generatedCredentials ? '閉じる' : 'キャンセル'}
            </button>
            {!generatedCredentials && (
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? '作成中...' : 'ユーザーを作成'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
