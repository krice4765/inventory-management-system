import { Link, useLocation } from 'react-router-dom';
import { Home, Package, Warehouse, Users, FileText, LogOut, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
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
    <motion.div 
      className="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-800 text-gray-900 dark:text-white flex flex-col border-r border-gray-200/50 dark:border-gray-700/50 shadow-xl backdrop-blur-md transition-all duration-300"
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
          <h1 className="text-white text-lg font-bold tracking-wide">統合業務管理システム</h1>
        </div>
      </motion.div>

      {/* ユーザー情報 */}
      <motion.div 
        className="px-6 py-4 border-b border-gray-200/30 dark:border-gray-700/30"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center">
          <motion.div 
            className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-white text-sm font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </motion.div>
          <div className="ml-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {user?.email}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">システム管理者</p>
          </div>
        </div>
      </motion.div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path || 
  (item.path === '/orders' && location.pathname.startsWith('/orders'));
            return (
              <motion.li 
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Link
                  to={item.path}
                  className={`group flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-[1.02]'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white hover:shadow-md hover:translate-x-1'
                  }`}
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <item.icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-blue-500'}`} />
                  </motion.div>
                  {item.name}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </nav>

      {/* ログアウトボタン */}
      <motion.div 
        className="px-4 py-4 border-t border-gray-200/30 dark:border-gray-700/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <motion.button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 group"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut className="w-5 h-5 mr-3 group-hover:text-red-500 transition-colors" />
          ログアウト
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
