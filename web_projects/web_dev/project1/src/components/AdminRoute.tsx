import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * 管理者専用ルート保護コンポーネント
 * 管理者権限を持つユーザーのみがアクセス可能
 * 権限がない場合はダッシュボードにリダイレクト
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const { userProfile, loading } = useAuthStore();

  // 認証情報ロード中は何も表示しない
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 管理者権限チェック
  if (userProfile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
