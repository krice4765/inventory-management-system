import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

// 開発環境での管理者ログイン情報保持
const getDefaultLoginValues = () => {
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';

  if (isDevelopment) {
    // 開発環境: 管理者アカウントをローテーション
    const adminAccounts = [
      { email: 'krice4765104@gmail.com', password: 'AdminPass123!' },
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

// パスワードリセット通知を管理者に送信する関数
const createPasswordResetNotification = async (email: string, status: 'success' | 'failed' | 'system_error' = 'success') => {
  try {
    // デバッグ: 受信したパラメータを確認
    console.log('ログイン処理開始:', {
      email,
      status,
      timestamp: new Date().toISOString()
    });

    // 管理者ユーザーIDを取得
    let { data: adminUsers, error: adminError } = await supabase
      .from('user_profiles')
      .select('id, email, role, is_active')
      .eq('role', 'admin')
      .eq('is_active', true);


    if (adminError) {
      console.error('管理者取得エラー:', adminError);
      // エラーの場合は特定の管理者メールを使用してフォールバック
      const adminEmails = ['krice4765104@gmail.com', 'dev@inventory.test', 'prod@inventory.test'];
      return;
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.warn('管理者ユーザーが見つかりません - 特定のメールアドレスで管理者を検索');

      // 管理者が見つからない場合は特定のメールアドレスで検索
      const { data: fallbackAdmins, error: fallbackError } = await supabase
        .from('user_profiles')
        .select('id, email, role, is_active')
        .in('email', ['krice4765104@gmail.com', 'dev@inventory.test', 'prod@inventory.test']);


      if (fallbackError || !fallbackAdmins || fallbackAdmins.length === 0) {
        console.error('フォールバック管理者も見つかりません - 既知の管理者IDを使用');

        // 最終フォールバック: 既知の管理者ID（krice4765104@gmail.com）を使用
        // この ID は UserManagement でログインしていることが確認されています
        const knownAdminId = '60604393-9b2f-4c20-8bcf-f33ea2593d22';
        adminUsers = [{
          id: knownAdminId,
          email: 'krice4765104@gmail.com',
          role: 'admin',
          is_active: true
        }];
      } else {
        // フォールバック管理者を使用
        adminUsers = fallbackAdmins;
      }
    }

    // ステータスに応じてメッセージを変更
    let title: string;
    let message: string;
    let type: string;

    switch (status) {
      case 'success':
        title = 'パスワードリセット要求';
        message = `ユーザー ${email} がパスワードリセットを要求しました。`;
        type = 'password_reset_request';
        break;
      case 'failed':
        title = 'パスワードリセット失敗';
        message = `ユーザー ${email} のパスワードリセットが失敗しました。アカウントが存在しない可能性があります。`;
        type = 'password_reset_failed';
        break;
      case 'system_error':
        title = 'パスワードリセットシステムエラー';
        message = `ユーザー ${email} のパスワードリセット処理中にシステムエラーが発生しました。`;
        type = 'password_reset_error';
        break;
    }

    // 各管理者に通知を作成
    const notifications = adminUsers.map(admin => ({
      user_id: admin.id,
      type,
      title,
      message,
      metadata: {
        requester_email: email,
        timestamp: new Date().toISOString(),
        status,
        action_required: status !== 'success'
      },
      is_read: false,
      created_at: new Date().toISOString()
    }));

    const { error: notificationError } = await supabase
      .from('system_notifications')
      .insert(notifications);

    if (notificationError) {
      console.error('通知作成エラー:', notificationError);
    } else {
    }
  } catch (error) {
    console.error('通知送信エラー:', error);
  }
};

export default function Login() {
  const defaultValues = getDefaultLoginValues();
  const [email, setEmail] = useState(defaultValues.email);
  const [password, setPassword] = useState(defaultValues.password);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);


    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('ログイン結果:', {
        success: !error,
        error: error?.message,
        user: data.user?.email
      });

      if (error) {
        toast.error(error.message);
      } else {
        // 開発環境での管理者アカウント使用履歴を保存
        const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
        if (isDevelopment && (email === 'krice4765104@gmail.com' || email === 'dev@inventory.test')) {
          localStorage.setItem('dev_last_email', email);
        }

        // Zustand storeを更新
        setUser(data.user);

        toast.success('ログインしました');

        // ダッシュボードにリダイレクト
        navigate('/');
      }
    } catch (catchError) {
      console.error('🚨 ログイン例外:', catchError);
      toast.error('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          在庫管理システム
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          アカウントにサインイン
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'サインイン中...' : 'サインイン'}
              </button>
            </div>
          </form>

          {/* パスワードリセットリンク */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  toast.error('メールアドレスを入力してください');
                  return;
                }
                try {
                  // 詳細なデバッグ情報を追加
                  console.log('パスワードリセット開始:', {
                    email,
                    timestamp: new Date().toISOString(),
                    supabaseUrl: supabase.supabaseUrl
                  });

                  // 直接パスワードリセットを実行
                  const { error } = await resetPassword(email);
                  if (error) {
                    console.error('パスワードリセットエラー詳細:', error);

                    // 特定のエラーに対してはユーザーフレンドリーなメッセージを表示
                    if (error.message?.includes('security purposes') ||
                        error.message?.includes('21 seconds') ||
                        error.message?.includes('rate limit')) {
                      toast.error('パスワードリセットのリクエストが集中しています。21秒後に再度お試しください。');
                      // レート制限の場合は管理者通知は不要
                      return;
                    } else if (error.message?.includes('invalid') || error.message?.includes('not found')) {
                      toast.error('指定されたメールアドレスが見つかりません。正しいメールアドレスを入力してください。');
                    } else {
                      toast.error('パスワードリセットに失敗しました: ' + error.message);
                    }

                    // エラーの場合（レート制限以外）は管理者に通知を送信
                    await createPasswordResetNotification(email, 'failed');
                    return;
                  }

                  // パスワードリセット通知を管理者に送信
                  await createPasswordResetNotification(email, 'success');

                  toast.success('パスワードリセット用のメールを送信しました');
                } catch (error: any) {
                  console.error('パスワードリセットエラー:', error);
                  toast.error('システムエラーが発生しました。管理者にお問い合わせください。');
                  await createPasswordResetNotification(email, 'system_error');
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-500 hover:underline"
            >
              パスワードを忘れた場合
            </button>
          </div>

          {/* 新規ユーザー申請リンク */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  初回ご利用の方
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/user-application"
                className="w-full flex justify-center py-2 px-4 border border-blue-300 rounded-md shadow-sm bg-white text-sm font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                システム利用を申請する
              </Link>
            </div>
          </div>
        </div>

        {/* フッター情報 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            システムのご利用には管理者による承認が必要です
          </p>
        </div>
      </div>
    </div>
  );
}
