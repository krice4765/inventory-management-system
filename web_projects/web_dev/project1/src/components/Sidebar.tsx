import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Package, Warehouse, Users, FileText, LogOut, CreditCard, Receipt, BookOpen, Calendar, BarChart3, ShoppingCart, TrendingUp, Settings, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function Sidebar() {
  const location = useLocation();
  const { user, userProfile, setUser } = useAuthStore();
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    inventory: true,
    partners: false,
    payable: false,
    receivable: false,
    reports: false,
    admin: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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

  // カテゴリー別ナビゲーション構造
  const navigationStructure = [
    {
      name: 'ダッシュボード',
      icon: Home,
      path: '/',
      type: 'single' as const,
    },
    {
      name: '在庫・商品管理',
      icon: Package,
      type: 'group' as const,
      key: 'inventory',
      items: [
        { name: '商品管理', icon: Package, path: '/products' },
        { name: '在庫管理', icon: Warehouse, path: '/inventory' },
      ],
    },
    {
      name: '取引先・受発注',
      icon: Users,
      type: 'group' as const,
      key: 'partners',
      items: [
        { name: '取引先管理', icon: Users, path: '/partners' },
        { name: '発注管理', icon: FileText, path: '/orders' },
        { name: '仕入伝票', icon: FileText, path: '/purchase-orders' },
        { name: '受注管理', icon: ShoppingCart, path: '/sales-orders' },
      ],
    },
    {
      name: '買掛金管理',
      icon: CreditCard,
      type: 'group' as const,
      key: 'payable',
      items: [
        { name: '買掛金管理', icon: CreditCard, path: '/accounts-payable' },
        { name: '買掛元帳', icon: BookOpen, path: '/accounts-payable-ledger' },
        { name: '支払予定', icon: Calendar, path: '/payment-schedule' },
        { name: '支払履歴', icon: Receipt, path: '/payments' },
        { name: '支払分析', icon: BarChart3, path: '/payment-dashboard' },
      ],
    },
    {
      name: '売掛金管理',
      icon: CreditCard,
      type: 'group' as const,
      key: 'receivable',
      items: [
        { name: '売掛金管理', icon: CreditCard, path: '/accounts-receivable' },
      ],
    },
    {
      name: 'レポート',
      icon: TrendingUp,
      type: 'group' as const,
      key: 'reports',
      items: [
        { name: '買掛金残高レポート', icon: TrendingUp, path: '/reports/payable' },
        { name: '支払履歴レポート', icon: TrendingUp, path: '/reports/payment-history' },
        { name: '売掛金残高レポート', icon: TrendingUp, path: '/reports/receivable' },
        { name: '入金履歴レポート', icon: TrendingUp, path: '/reports/receipt-history' },
        { name: '在庫状況レポート', icon: TrendingUp, path: '/reports/inventory' },
        { name: '在庫移動履歴レポート', icon: TrendingUp, path: '/reports/inventory-movement' },
      ],
    },
  ];

  // 管理者専用メニュー
  const adminSection = {
    name: '管理者メニュー',
    icon: Settings,
    type: 'group' as const,
    key: 'admin',
    items: [
      { name: 'ユーザー管理', icon: Settings, path: '/admin/users' },
      { name: '会社設定', icon: Building2, path: '/admin/company-settings' },
    ],
  };

  const isPathActive = (path: string) => {
    return location.pathname === path ||
      (path === '/orders' && location.pathname.startsWith('/orders')) ||
      (path === '/sales-orders' && location.pathname.startsWith('/sales-orders'));
  };

  const isSectionActive = (items: Array<{ path: string }>) => {
    return items.some(item => isPathActive(item.path));
  };

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-gray-800 text-white flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-center h-16 bg-blue-600 border-b border-gray-700">
        <h1 className="text-white text-lg font-semibold">在庫管理システム</h1>
      </div>

      {/* ユーザー情報 */}
      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {userProfile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-white">
              {userProfile?.full_name || user?.email}
            </p>
            <p className="text-xs text-gray-300">
              {userProfile?.role === 'admin' ? '管理者' :
               userProfile?.role === 'manager' ? 'マネージャー' : 'スタッフ'}
            </p>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navigationStructure.map((section) => {
            if (section.type === 'single') {
              const isActive = isPathActive(section.path);
              return (
                <li key={section.name}>
                  <Link
                    to={section.path}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <section.icon className="w-5 h-5 mr-3" />
                    {section.name}
                  </Link>
                </li>
              );
            }

            const isOpen = openSections[section.key];
            const hasActiveChild = isSectionActive(section.items);

            return (
              <li key={section.name}>
                <button
                  onClick={() => toggleSection(section.key)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    hasActiveChild
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <section.icon className="w-5 h-5 mr-3" />
                    {section.name}
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <ul className="mt-1 ml-6 space-y-1">
                    {section.items.map((item) => {
                      const isActive = isPathActive(item.path);
                      return (
                        <li key={item.name}>
                          <Link
                            to={item.path}
                            className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                          >
                            <item.icon className="w-4 h-4 mr-3" />
                            {item.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}

          {/* 管理者専用メニュー */}
          {userProfile?.role === 'admin' && (
            <>
              <li className="pt-2 mt-2 border-t border-gray-700">
                <button
                  onClick={() => toggleSection(adminSection.key)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isSectionActive(adminSection.items)
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <adminSection.icon className="w-5 h-5 mr-3" />
                    {adminSection.name}
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${openSections[adminSection.key] ? 'transform rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openSections[adminSection.key] && (
                  <ul className="mt-1 ml-6 space-y-1">
                    {adminSection.items.map((item) => {
                      const isActive = isPathActive(item.path);
                      return (
                        <li key={item.name}>
                          <Link
                            to={item.path}
                            className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                          >
                            <item.icon className="w-4 h-4 mr-3" />
                            {item.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            </>
          )}
        </ul>
      </nav>

      {/* ログアウトボタン */}
      <div className="px-4 py-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          ログアウト
        </button>
      </div>
    </div>
  );
}
