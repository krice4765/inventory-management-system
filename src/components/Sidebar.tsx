import { Link, useLocation } from 'react-router-dom';
import { Home, Package, Warehouse, Users, FileText, LogOut, Sparkles, Menu, X, BarChart3, Shield, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useDarkMode } from '../hooks/useDarkMode';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';

export default function Sidebar() {
  const location = useLocation();
  const { user, setUser } = useAuthStore();
  const { isDark: _isDark } = useDarkMode();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // モバイルメニューを閉じる（リンククリック時）
  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  // 画面サイズ変更時にモバイルメニューを閉じる
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    { name: 'パフォーマンス', icon: BarChart3, path: '/performance' },
    { name: '整合性管理', icon: Shield, path: '/integrity-management' },
    { name: 'データ整合性', icon: Settings, path: '/integrity' },
  ];

  return (
    <>
      {/* モバイルハンバーガーメニューボタン */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <motion.button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </motion.button>
      </div>

      {/* オーバーレイ（モバイル用） */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバー */}
      <motion.div
        className={`fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-800 text-gray-900 dark:text-white flex flex-col border-r border-gray-200/50 dark:border-gray-700/50 shadow-xl backdrop-blur-md transition-all duration-300 z-50 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        initial={{ x: -64 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
      {/* ヘッダー */}
      <motion.div
        className="flex items-center justify-center h-16 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 relative overflow-hidden"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 animate-pulse"></div>
        <div className="relative flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-white animate-pulse" />
          <span className="text-xl font-bold text-white tracking-tight">商品管理</span>
        </div>
      </motion.div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-4 pb-4 mt-8 overflow-y-auto">
        <ul className="space-y-2">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <motion.li
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={item.path}
                  onClick={handleLinkClick}
                  className={`
                    group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 relative overflow-hidden
                    ${isActive
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-400/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-700/70 hover:text-gray-900 dark:hover:text-white hover:shadow-md'
                    }
                  `}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0 relative z-10" />
                  <span className="relative z-10">{item.name}</span>
                  {isActive && (
                    <motion.div
                      className="absolute right-2 w-2 h-2 bg-white rounded-full"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2 }}
                    />
                  )}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </nav>

      {/* ユーザー情報とログアウト */}
      <motion.div
        className="px-4 py-4 border-t border-gray-200/50 dark:border-gray-700/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0 flex-1">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">オンライン</p>
            </div>
          </div>
          <motion.button
            onClick={handleLogout}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
    </>
  );
}