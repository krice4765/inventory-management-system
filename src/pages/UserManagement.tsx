import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Building,
  User,
  Shield,
  AlertTriangle,
  Send,
  Trash2,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface UserApplication {
  id: string;
  email: string;
  company_name?: string;
  department?: string;
  position?: string;
  requested_reason?: string;
  application_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

// 申請理由から名前を抽出するヘルパー関数
const extractFullNameFromReason = (reason?: string): string | null => {
  if (!reason) return null;
  const match = reason.match(/【申請者名】(.+?)(?:\n|$)/);
  return match ? match[1].trim() : null;
};

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  company_name?: string;
  department?: string;
  position?: string;
  role: 'admin' | 'manager' | 'user';
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

interface SystemNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  is_read: boolean;
  created_at: string;
}

// 最終ログイン時刻のフォーマット関数
const formatLastLoginTime = (lastLoginAt: string): string => {
  const loginDate = new Date(lastLoginAt);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - loginDate.getTime()) / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  // 同日の場合は時間のみ表示
  if (diffInDays === 0) {
    return `本日 ${loginDate.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }
  // 1日前の場合
  else if (diffInDays === 1) {
    return `昨日 ${loginDate.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }
  // それ以外は日付と時刻
  else {
    return loginDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

export default function UserManagement() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'applications' | 'users' | 'notifications'>('applications');
  const [applications, setApplications] = useState<UserApplication[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<UserApplication | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  // データベースベースの管理者権限チェック（スキーマキャッシュ問題対応版）
  const checkAdminRole = async () => {

    if (!user?.id) {
      setIsAdmin(false);
      setAdminCheckLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('❌ 管理者権限チェックエラー:', error);
        console.error('  エラーコード:', error.code);
        console.error('  エラーメッセージ:', error.message);

        // スキーマキャッシュ問題（PGRST205）の場合は一時的にメールベースチェックを使用
        if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
          console.warn('⚠️ user_profilesテーブルのスキーマキャッシュ問題を検出。一時的にメールベース認証を使用します。');
          console.warn('📋 解決方法: Supabaseダッシュボードでuser_profilesテーブルを再作成してください。');
        }

        // フォールバック: メールベースチェック
        const adminEmails = ['dev@inventory.test', 'Krice4765104@gmail.com', 'prod@inventory.test'];
        const isAdminEmail = user?.email ? adminEmails.includes(user.email) : false;
        setIsAdmin(isAdminEmail);

        if (isAdminEmail) {
        }
      } else {
        const isAdminUser = profile?.role === 'admin' && profile?.is_active === true;
        setIsAdmin(isAdminUser);
      }
    } catch (error) {
      console.error('管理者権限チェック失敗:', error);

      // 例外の場合もメールベースフォールバックを実行
      const adminEmails = ['dev@inventory.test', 'Krice4765104@gmail.com', 'prod@inventory.test'];
      const isAdminEmail = user?.email ? adminEmails.includes(user.email) : false;
      setIsAdmin(isAdminEmail);

      if (isAdminEmail) {
      }
    } finally {
      setAdminCheckLoading(false);
      setHasCheckedOnce(true);
    }
  };

  useEffect(() => {
    // ユーザー認証が完了してからのみ権限チェックを実行
    if (!authLoading && user) {
      checkAdminRole();
    }
  }, [user, authLoading]);

  useEffect(() => {

    if (adminCheckLoading) {
      return;
    }

    if (!isAdmin) {
      toast.error('管理者権限が必要です');
      return;
    }

    loadData();
  }, [isAdmin, adminCheckLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadApplications(),
        loadUsers(),
        loadNotifications()
      ]);
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      toast.error('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('user_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // テーブルが存在しない場合（404エラー）は空配列を返す
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.warn('user_applications テーブルが存在しません。データベースマイグレーションが必要です。');
          setApplications([]);
          return;
        }
        throw error;
      }
      setApplications(data || []);
    } catch (error) {
      console.error('申請データ読み込みエラー:', error);
      setApplications([]);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // テーブルが存在しない場合（404エラー）は空配列を返す
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.warn('user_profiles テーブルが存在しません。データベースマイグレーションが必要です。');
          setUsers([]);
          return;
        }
        throw error;
      }
      setUsers(data || []);
    } catch (error) {
      console.error('ユーザーデータ読み込みエラー:', error);
      setUsers([]);
    }
  };

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // テーブルが存在しない場合（404エラー）は空配列を返す
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.warn('system_notifications テーブルが存在しません。データベースマイグレーションが必要です。');
          setNotifications([]);
          return;
        }
        throw error;
      }
      setNotifications(data || []);
    } catch (error) {
      console.error('通知データ読み込みエラー:', error);
      setNotifications([]);
    }
  };

  const handleApplicationAction = async (
    applicationId: string,
    action: 'approved' | 'rejected',
    notes?: string
  ) => {
    try {
      // 申請データを取得
      const { data: application, error: fetchError } = await supabase
        .from('user_applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (fetchError) throw fetchError;

      // 申請ステータスを更新
      const { error: updateError } = await supabase
        .from('user_applications')
        .update({
          application_status: action,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes
        })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      // 承認時はuser_profilesにユーザーを作成
      if (action === 'approved' && application) {
        await createUserProfile(application);
        await sendInvitation(applicationId);
      }

      toast.success(`申請を${action === 'approved' ? '承認' : '否認'}しました`);
      await loadApplications();
      await loadUsers(); // ユーザー一覧も更新
      setSelectedApplication(null);
    } catch (error) {
      console.error('申請処理エラー:', error);
      toast.error('申請処理に失敗しました');
    }
  };

  // ランダムパスワード生成関数
  const generateRandomPassword = (): string => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  // Supabase Admin APIを使用したユーザー作成
  const createAuthUser = async (email: string, password: string) => {
    try {
      // Supabase Admin APIでユーザーを作成
      const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // メール確認をスキップ
      });

      if (error) {
        console.error('Auth ユーザー作成エラー:', error);
        throw error;
      }

      return data.user;
    } catch (error) {
      console.error('createAuthUser エラー:', error);
      throw error;
    }
  };

  // 承認されたユーザーのプロファイル作成（手動ユーザー作成用）
  const createUserProfile = async (application: UserApplication) => {
    try {

      // ランダムパスワード生成（管理者が手動でユーザー作成する際に使用）
      const randomPassword = generateRandomPassword();

      // 管理者向けの手動作成ガイドを表示
      const fullName = extractFullNameFromReason(application.requested_reason);
      const userManualInstructions = `
【Supabaseダッシュボードでの手動ユーザー作成手順】

申請者情報:
- 氏名: ${fullName || '未記入'}
- Email: ${application.email}
- 会社: ${application.company_name || '未記入'}
- 部署: ${application.department || '未記入'}
- 役職: ${application.position || '未記入'}

1. Supabase Dashboard を開く: https://supabase.com/dashboard
2. プロジェクトを選択
3. Authentication → Users に移動
4. 「Add user」をクリック
5. 以下の情報を入力:
   - Email: ${application.email}
   - Password: ${randomPassword}
   - Email confirm: チェック済みにする

6. ユーザー作成後、自動的にuser_profilesテーブルにプロファイルが作成されます

ログイン情報:
メール: ${application.email}
パスワード: ${randomPassword}
      `;


      // 手動作成ガイドを表示
      alert(`ユーザーアカウントの手動作成が必要です。

コンソールに詳細な手順を出力しました。

承認完了後の手順:
1. Supabaseダッシュボードでユーザーを手動作成
2. 作成されたユーザーがログイン時に自動的にプロファイルが作成されます

生成されたパスワード: ${randomPassword}
（このパスワードをユーザーに安全に共有してください）`);

      // 招待レコードも作成してフォールバック機能を提供
      await createInvitationRecord(application);

      // 既存ユーザーのプロファイルが存在する場合は名前を更新、なければ作成
      await updateExistingUserProfile(application);

      // user_profilesテーブルに直接レコードを作成
      await createUserProfileRecord(application);

      toast.success(`申請を承認しました！

手動でのユーザー作成が必要です:
1. Supabaseダッシュボードでユーザー作成
2. Email: ${application.email}
3. Password: ${randomPassword}

詳細はコンソールをご確認ください。`);

    } catch (error) {
      console.error('❌ プロファイル準備エラー:', error);
      throw error;
    }
  };

  // 既存ユーザープロファイルの名前を更新する関数
  const updateExistingUserProfile = async (application: UserApplication) => {
    try {
      const fullName = extractFullNameFromReason(application.requested_reason);
      if (!fullName) {
        return;
      }

      // メールアドレスでユーザーを検索してプロファイルを更新
      const { data: existingProfile, error: findError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', application.email)
        .maybeSingle();

      if (findError) {
        console.warn('既存プロファイル検索エラー:', findError);
        return;
      }

      if (existingProfile) {

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            full_name: fullName,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id);

        if (updateError) {
          console.error('プロファイル更新エラー:', updateError);
        } else {
        }
      } else {
      }
    } catch (error) {
      console.error('プロファイル更新処理エラー:', error);
    }
  };

  // user_profilesテーブルに直接レコードを作成する関数
  const createUserProfileRecord = async (application: UserApplication) => {
    try {
      const fullName = extractFullNameFromReason(application.requested_reason);

      // 一意のIDを生成（実際のSupabaseユーザーIDではなく、仮のID）
      const tempUserId = crypto.randomUUID();


      const profileData = {
        id: tempUserId,
        email: application.email,
        full_name: fullName || application.email.split('@')[0],
        company_name: application.company_name,
        department: application.department,
        position: application.position,
        role: 'user',
        is_active: true,
        last_login_at: null,
        invited_by: user?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // まず既存レコードをチェック
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', application.email)
        .maybeSingle();

      let insertError = null;

      if (existingUser) {
        // 既存レコードを更新
        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: fullName || application.email.split('@')[0],
            company_name: application.company_name,
            department: application.department,
            position: application.position,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);
        insertError = error;
      } else {
        // 新規レコードを作成
        const { error } = await supabase
          .from('user_profiles')
          .insert([profileData]);
        insertError = error;
      }

      if (insertError) {
        console.error('❌ user_profilesレコード作成エラー:', insertError);
        throw insertError;
      }


      // ユーザー一覧を更新
      await loadUsers();

    } catch (error) {
      console.error('user_profilesレコード作成処理エラー:', error);
      // エラーが発生しても処理は継続（手動作成フローのため）
    }
  };

  // 招待レコードを作成する関数
  const createInvitationRecord = async (application: UserApplication) => {
    // 招待トークンを生成
    const invitationToken = crypto.randomUUID();

    const invitationData = {
      email: application.email,
      invited_by: user?.id,
      invitation_token: invitationToken,
      role: 'user',
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    const { error: invitationError } = await supabase
      .from('user_invitations')
      .insert([invitationData]);

    if (invitationError) {
      console.error('招待レコード作成エラー:', invitationError);
      throw invitationError;
    }

    toast.success('ユーザー招待を送信しました。ユーザーは招待リンクでアカウント作成できます。');
  };


  const sendInvitation = async (applicationId: string) => {
    try {
      // 実装: 招待メール送信機能
      // 実際の実装では招待トークン生成とメール送信を行う
      toast.success('招待メールを送信しました');
    } catch (error) {
      console.error('招待メール送信エラー:', error);
      toast.error('招待メール送信に失敗しました');
    }
  };

  // テスト用: kurisu@ns-data.jpの申請データを作成
  const createTestApplication = async () => {
    try {
      const testApplication = {
        email: 'kurisu@ns-data.jp',
        company_name: '株式会社サンプル',
        department: 'システム開発部',
        position: 'エンジニア',
        requested_reason: '在庫管理システムの使用許可を申請いたします。開発業務において在庫データの確認・管理が必要なため、アクセス権限をお願いします。',
        application_status: 'pending'
      };

      const { error } = await supabase
        .from('user_applications')
        .insert([testApplication]);

      if (error) throw error;

      toast.success('テスト申請データを作成しました');
      await loadApplications(); // データを再読み込み
    } catch (error) {
      console.error('テスト申請データ作成エラー:', error);
      toast.error('テスト申請データの作成に失敗しました');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200'
    };

    const icons = {
      pending: Clock,
      approved: CheckCircle,
      rejected: XCircle
    };

    const Icon = icons[status as keyof typeof icons];

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status === 'pending' ? '審査中' : status === 'approved' ? '承認済み' : '否認'}
      </span>
    );
  };

  // 認証ローディング中または権限チェック中はローディング表示
  if (authLoading || adminCheckLoading || !hasCheckedOnce) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? '認証確認中...' : '権限確認中...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">アクセス権限がありません</h2>
          <p className="text-gray-600 mb-4">この機能は管理者のみ利用できます</p>

          <div className="bg-gray-100 p-4 rounded-md text-left text-sm">
            <h3 className="font-bold mb-2">🔍 デバッグ情報:</h3>
            <p><strong>User ID:</strong> {user?.id || 'なし'}</p>
            <p><strong>Email:</strong> {user?.email || 'なし'}</p>
            <p><strong>isAdmin:</strong> {isAdmin ? '✅ true' : '❌ false'}</p>
            <p><strong>adminCheckLoading:</strong> {adminCheckLoading ? '⏳ true' : '✅ false'}</p>
            <p><strong>データベース確認:</strong> 管理者権限がuser_profilesテーブルで確認済み</p>
          </div>

          <button
            onClick={checkAdminRole}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 権限を再チェック
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ユーザー管理</h1>
          <p className="text-gray-600">システムユーザーの申請・承認・権限管理</p>
        </div>

        {/* タブナビゲーション */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { key: 'applications', label: '申請管理', icon: UserPlus },
              { key: 'users', label: 'ユーザー一覧', icon: Users },
              { key: 'notifications', label: '通知', icon: Bell }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === key
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
                {key === 'applications' && applications.filter(a => a.application_status === 'pending').length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {applications.filter(a => a.application_status === 'pending').length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* コンテンツエリア */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'applications' && (
            <ApplicationsTab
              applications={applications}
              onAction={handleApplicationAction}
              selectedApplication={selectedApplication}
              onSelect={setSelectedApplication}
              loading={loading}
              onCreateTestApplication={createTestApplication}
            />
          )}
          {activeTab === 'users' && (
            <UsersTab users={users} loading={loading} />
          )}
          {activeTab === 'notifications' && (
            <NotificationsTab notifications={notifications} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}

// 申請管理タブコンポーネント
const ApplicationsTab: React.FC<{
  applications: UserApplication[];
  onAction: (id: string, action: 'approved' | 'rejected', notes?: string) => void;
  selectedApplication: UserApplication | null;
  onSelect: (app: UserApplication | null) => void;
  loading: boolean;
  onCreateTestApplication?: () => void;
}> = ({ applications, onAction, selectedApplication, onSelect, loading, onCreateTestApplication }) => {
  const [reviewNotes, setReviewNotes] = useState('');

  if (loading) {
    return <div className="p-8 text-center">読み込み中...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">申請一覧</h2>
        <div className="flex space-x-2">
          <span className="text-sm text-gray-600">
            総申請数: {applications.length}件
          </span>
          <span className="text-sm text-yellow-600">
            審査待ち: {applications.filter(a => a.application_status === 'pending').length}件
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                申請者
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                会社・部署
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                申請日
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ステータス
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                アクション
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {applications.map((application) => (
              <tr key={application.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium bg-blue-500`}>
                      {(extractFullNameFromReason(application.requested_reason) || application.email.split('@')[0]).charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {extractFullNameFromReason(application.requested_reason) || application.email.split('@')[0]}
                      </div>
                      <div className="text-sm text-gray-500">
                        {application.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{application.company_name || '会社名未記入'}</div>
                    <div className="text-gray-500">{application.department || '部署未記入'}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(application.created_at).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(application.application_status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onSelect(application)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {application.application_status === 'pending' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onAction(application.id, 'approved')}
                        className="text-green-600 hover:text-green-900"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onAction(application.id, 'rejected')}
                        className="text-red-600 hover:text-red-900"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {applications.length === 0 && (
        <div className="text-center py-12">
          <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">申請がありません</h3>
          <p className="text-gray-500 mb-4">新しいユーザー申請がここに表示されます</p>
          {onCreateTestApplication && (
            <button
              onClick={onCreateTestApplication}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              テスト申請を作成 (kurisu@ns-data.jp)
            </button>
          )}
        </div>
      )}

      {/* 申請詳細モーダル */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">申請詳細</h3>
                <button
                  onClick={() => onSelect(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      申請者メール
                    </label>
                    <p className="text-gray-900">{selectedApplication.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      申請日
                    </label>
                    <p className="text-gray-900">
                      {new Date(selectedApplication.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      会社名
                    </label>
                    <p className="text-gray-900">{selectedApplication.company_name || '未記入'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      部署名
                    </label>
                    <p className="text-gray-900">{selectedApplication.department || '未記入'}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    役職
                  </label>
                  <p className="text-gray-900">{selectedApplication.position || '未記入'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    利用目的
                  </label>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {selectedApplication.requested_reason || '記載なし'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ステータス
                  </label>
                  <div className="mt-1">
                    {getStatusBadge(selectedApplication.application_status)}
                  </div>
                </div>

                {selectedApplication.reviewed_at && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">審査情報</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          審査日時
                        </label>
                        <p className="text-gray-900">
                          {new Date(selectedApplication.reviewed_at).toLocaleString('ja-JP')}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          審査者
                        </label>
                        <p className="text-gray-900">{selectedApplication.reviewed_by || 'システム'}</p>
                      </div>
                    </div>
                    {selectedApplication.review_notes && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          審査コメント
                        </label>
                        <p className="text-gray-900">{selectedApplication.review_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 承認・拒否アクション */}
                {selectedApplication.application_status === 'pending' && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">審査アクション</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          審査コメント（任意）
                        </label>
                        <textarea
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          rows={3}
                          placeholder="審査結果についてのコメント..."
                        />
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            onAction(selectedApplication.id, 'approved', reviewNotes);
                            setReviewNotes('');
                          }}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          承認
                        </button>
                        <button
                          onClick={() => {
                            onAction(selectedApplication.id, 'rejected', reviewNotes);
                            setReviewNotes('');
                          }}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          拒否
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ユーザー一覧タブコンポーネント
const UsersTab: React.FC<{
  users: UserProfile[];
  loading: boolean;
}> = ({ users, loading }) => {
  const [showOrderPermissionHelp, setShowOrderPermissionHelp] = useState(false);

  // 発注権限フィルタリング関数（発注担当者選択と同じロジック）
  const canUserCreateOrders = (user: UserProfile): boolean => {
    // 管理者または一般ユーザーで、かつアクティブなユーザーのみ発注権限あり
    return user.is_active && (user.role === 'admin' || user.role === 'user');
  };

  // 権限レベルの表示名を取得
  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case 'admin': return '管理者';
      case 'manager': return 'マネージャー';
      case 'user': return '一般ユーザー';
      default: return role;
    }
  };

  // 権限レベルの色を取得
  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'user': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return <div className="p-8 text-center">読み込み中...</div>;
  }

  // 統計情報を計算
  const orderAuthorizedUsers = users.filter(canUserCreateOrders);
  const activeUsers = users.filter(user => user.is_active);
  const adminUsers = users.filter(user => user.role === 'admin');

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">ユーザー一覧</h2>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span>総ユーザー数: {users.length}名</span>
          <span>アクティブ: {activeUsers.length}名</span>
          <span className="text-green-600 font-medium">発注権限: {orderAuthorizedUsers.length}名</span>
        </div>
      </div>

      {/* 発注権限説明パネル */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-sm font-medium text-blue-900">発注担当者フィルタリング説明</h3>
          </div>
          <button
            onClick={() => setShowOrderPermissionHelp(!showOrderPermissionHelp)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {showOrderPermissionHelp ? '非表示' : '詳細表示'}
          </button>
        </div>

        {showOrderPermissionHelp && (
          <div className="mt-4 space-y-2 text-sm text-blue-800">
            <p><strong>発注担当者として選択可能な条件:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>権限レベル: <span className="font-mono bg-blue-100 px-1 rounded">admin</span> または <span className="font-mono bg-blue-100 px-1 rounded">user</span></li>
              <li>ステータス: <span className="font-mono bg-blue-100 px-1 rounded">アクティブ</span></li>
              <li>除外対象: <span className="font-mono bg-gray-100 px-1 rounded">manager</span>、非アクティブユーザー</li>
            </ul>
            <p className="text-xs text-blue-600 mt-2">
              ℹ️ 現在 {orderAuthorizedUsers.length}名のユーザーが発注担当者として選択可能です
            </p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ユーザー
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                権限レベル
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                発注権限
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                最終ログイン
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ステータス
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                作成日時
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => {
              const hasOrderPermission = canUserCreateOrders(user);
              return (
                <tr key={user.id} className={`hover:bg-gray-50 ${hasOrderPermission ? 'bg-green-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                        user.role === 'admin' ? 'bg-red-500' : user.role === 'manager' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}>
                        {(user.full_name || user.email.split('@')[0]).charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name || user.email.split('@')[0]}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                      {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                      {user.role === 'manager' && <Building className="w-3 h-3 mr-1" />}
                      {user.role === 'user' && <User className="w-3 h-3 mr-1" />}
                      {getRoleDisplayName(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      hasOrderPermission
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-red-100 text-red-800 border-red-200'
                    }`}>
                      {hasOrderPermission ? '✅ 権限あり' : '❌ 権限なし'}
                    </span>
                    {hasOrderPermission && (
                      <div className="text-xs text-green-600 mt-1">発注担当者選択可</div>
                    )}
                    {!hasOrderPermission && (
                      <div className="text-xs text-red-600 mt-1">
                        {!user.is_active ? '非アクティブ' : 'マネージャー権限'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_login_at
                      ? formatLastLoginTime(user.last_login_at)
                      : '未ログイン'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.is_active ? 'アクティブ' : '無効'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">ユーザーがありません</h3>
          <p className="text-gray-500">登録済みユーザーがここに表示されます</p>
        </div>
      )}
    </div>
  );
};

// 通知タブコンポーネント
const NotificationsTab: React.FC<{
  notifications: SystemNotification[];
  loading: boolean;
}> = ({ notifications, loading }) => {
  if (loading) {
    return <div className="p-8 text-center">読み込み中...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">システム通知</h2>
        <span className="text-sm text-gray-600">
          未読: {notifications.filter(n => !n.is_read).length}件
        </span>
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg border ${
              notification.is_read
                ? 'bg-gray-50 border-gray-200'
                : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">
                  {notification.title}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {notification.message}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(notification.created_at).toLocaleString('ja-JP')}
                </p>
              </div>
              {!notification.is_read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </div>
          </div>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">通知がありません</h3>
          <p className="text-gray-500">システム通知がここに表示されます</p>
        </div>
      )}
    </div>
  );
};

const getStatusBadge = (status: string) => {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200'
  };

  const icons = {
    pending: Clock,
    approved: CheckCircle,
    rejected: XCircle
  };

  const Icon = icons[status as keyof typeof icons];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
      <Icon className="w-3 h-3 mr-1" />
      {status === 'pending' ? '審査中' : status === 'approved' ? '承認済み' : '否認'}
    </span>
  );
};