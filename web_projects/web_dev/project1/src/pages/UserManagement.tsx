import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { UserPlus, Edit2, Search, Users, CheckCircle, XCircle, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import UserInviteModal from '../components/UserInviteModal';
import PasswordResetModal from '../components/PasswordResetModal';
import { UserRole, roleDisplayNames } from '../types';

// Supabase Authユーザー型
interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    department?: string;
    position?: string;
    role?: UserRole;
    invited_at?: string;
  };
  created_at: string;
  banned_until?: string;
}

export default function UserManagement() {
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);

  // ユーザー一覧を取得（Supabase Admin APIを使用）
  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ['auth-users'],
    queryFn: async () => {
      // Edge Functionを経由してユーザー一覧を取得（全ユーザー取得用）
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('認証セッションが見つかりません');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-all-users`,
        {
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('ユーザー一覧の取得に失敗しました');
      }

      const result = await response.json();
      return result.users as AuthUser[];
    },
  });

  // フィルタリングされたユーザーリスト
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users.filter(user => {
      const metadata = user.user_metadata || {};
      const isActive = !user.banned_until;

      // テキスト検索
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesSearch =
          metadata.full_name?.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          metadata.department?.toLowerCase().includes(searchLower) ||
          metadata.position?.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // ロールフィルター
      const userRole = metadata.role || 'staff';
      if (roleFilter !== 'all' && userRole !== roleFilter) {
        return false;
      }

      // ステータスフィルター
      if (statusFilter === 'active' && !isActive) {
        return false;
      }
      if (statusFilter === 'inactive' && isActive) {
        return false;
      }

      return true;
    });
  }, [users, searchText, roleFilter, statusFilter]);

  // 統計情報
  const stats = useMemo(() => {
    if (!users) return {
      total: 0,
      active: 0,
      admins: 0,
      managers: 0,
      staff: 0,
      purchasing_staff: 0,
      inventory_staff: 0,
      sales_staff: 0,
      accounting_staff: 0,
      readonly: 0
    };

    return {
      total: users.length,
      active: users.filter(u => !u.banned_until).length,
      admins: users.filter(u => u.user_metadata?.role === 'admin').length,
      managers: users.filter(u => u.user_metadata?.role === 'manager').length,
      staff: users.filter(u => !u.user_metadata?.role || u.user_metadata?.role === 'staff').length,
      purchasing_staff: users.filter(u => u.user_metadata?.role === 'purchasing_staff').length,
      inventory_staff: users.filter(u => u.user_metadata?.role === 'inventory_staff').length,
      sales_staff: users.filter(u => u.user_metadata?.role === 'sales_staff').length,
      accounting_staff: users.filter(u => u.user_metadata?.role === 'accounting_staff').length,
      readonly: users.filter(u => u.user_metadata?.role === 'readonly').length,
    };
  }, [users]);

  // ロール表示名
  const getRoleLabel = (role?: UserRole | string) => {
    if (!role) return roleDisplayNames.staff;
    return roleDisplayNames[role as UserRole] || roleDisplayNames.staff;
  };

  // ユーザー削除（BAN）
  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('このユーザーを無効化してもよろしいですか？')) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('認証セッションが見つかりません');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ban-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ユーザーの無効化に失敗しました');
      }

      toast.success('ユーザーを無効化しました');
      refetch();
    } catch (error: any) {
      console.error('Error deactivating user:', error);
      toast.error(error.message || 'ユーザーの無効化に失敗しました');
    }
  };

  // ユーザー有効化（UNBAN）
  const handleActivateUser = async (userId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('認証セッションが見つかりません');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unban-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'ユーザーの有効化に失敗しました');
      }

      toast.success('ユーザーを有効化しました');
      refetch();
    } catch (error: any) {
      console.error('Error activating user:', error);
      toast.error(error.message || 'ユーザーの有効化に失敗しました');
    }
  };

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          エラーが発生しました: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            システムユーザーの管理と権限設定
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          ユーザー招待
        </button>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">総ユーザー数</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">有効ユーザー</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-500">管理者</p>
            <p className="text-2xl font-semibold text-red-600">{stats.admins}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-500">マネージャー</p>
            <p className="text-2xl font-semibold text-yellow-600">{stats.managers}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-500">スタッフ</p>
            <p className="text-2xl font-semibold text-blue-600">{stats.staff}</p>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 検索 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              検索
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="名前、メール、部署、役職で検索..."
                className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ロールフィルター */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ロール
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">すべて</option>
              <option value="admin">システム管理者</option>
              <option value="manager">部門管理者</option>
              <option value="purchasing_staff">発注担当者</option>
              <option value="inventory_staff">在庫管理担当者</option>
              <option value="sales_staff">営業担当者</option>
              <option value="accounting_staff">経理担当者</option>
              <option value="staff">一般スタッフ</option>
              <option value="readonly">閲覧専用</option>
            </select>
          </div>

          {/* ステータスフィルター */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ステータス
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">すべて</option>
              <option value="active">有効</option>
              <option value="inactive">無効</option>
            </select>
          </div>
        </div>
      </div>

      {/* ユーザーテーブル */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ユーザー
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ロール
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  部署・役職
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  登録日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    ユーザーが見つかりません
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const metadata = user.user_metadata || {};
                  const isActive = !user.banned_until;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                              <span className="text-white font-medium">
                                {metadata.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {metadata.full_name || '未設定'}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          metadata.role === 'admin' ? 'bg-red-100 text-red-800' :
                          metadata.role === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {getRoleLabel(metadata.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{metadata.department || '-'}</div>
                        <div className="text-xs text-gray-400">{metadata.position || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isActive ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            有効
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            無効
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowPasswordResetModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="パスワードリセット"
                          >
                            <Key className="w-5 h-5" />
                          </button>
                          {isActive ? (
                            <button
                              onClick={() => handleDeactivateUser(user.id)}
                              className="text-red-600 hover:text-red-900"
                              title="無効化"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivateUser(user.id)}
                              className="text-green-600 hover:text-green-900"
                              title="有効化"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ユーザー招待モーダル */}
      <UserInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => refetch()}
      />

      {/* パスワードリセットモーダル */}
      {selectedUser && (
        <PasswordResetModal
          isOpen={showPasswordResetModal}
          onClose={() => {
            setShowPasswordResetModal(false);
            setSelectedUser(null);
          }}
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          userName={selectedUser.user_metadata?.full_name || ''}
        />
      )}
    </div>
  );
}
