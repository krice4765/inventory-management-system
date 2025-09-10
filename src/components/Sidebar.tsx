import { Link, useLocation } from 'react-router-dom';
import { Home, Package, Warehouse, Users, FileText, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useDarkMode } from '../hooks/useDarkMode';
import toast from 'react-hot-toast';

export default function Sidebar() {
  const location = useLocation();
  const { user, setUser } = useAuthStore();
  const { isDark } = useDarkMode();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      toast.success('ログアウトしました');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('ログアウトに失敗しました');
    }
  };

  const navItems = [
    { name: 'ダッシュボード', icon: Home, path: '/' },
    { name: '商品管理', icon: Package, path: '/products' },
    { name: '在庫管理', icon: Warehouse, path: '/inventory' },
    { name: '取引先管理', icon: Users, path: '/partners' },
    { name: '発注管理', icon: FileText, path: '/orders' },
    { name: '仕入伝票', icon: FileText, path: '/purchase-orders' },
  ];

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex flex-col border-r border-gray-200 dark:border-gray-700 transition-colors duration-300">
      {/* ヘッダー */}
      <div className="flex items-center justify-center h-16 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-gray-900 dark:text-white text-lg font-semibold">在庫管理システム</h1>
      </div>

      {/* ユーザー情報 */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {user?.email}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">管理者</p>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
  (item.path === '/orders' && location.pathname.startsWith('/orders'));
            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ログアウトボタン */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          ログアウト
        </button>
      </div>
    </div>
  );
}
