import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tags,
  Truck,
  BarChart3,
  ShoppingCart,
  TrendingUp,
  Settings,
  Package2,
} from 'lucide-react';

const navigation = [
  { name: 'ダッシュボード', href: '/', icon: LayoutDashboard },
  { name: '商品管理', href: '/products', icon: Package },
  { name: 'カテゴリ管理', href: '/categories', icon: Tags },
  { name: '仕入先管理', href: '/suppliers', icon: Truck },
  { name: '在庫管理', href: '/inventory', icon: Package2 },
  { name: '売上管理', href: '/sales', icon: ShoppingCart },
  { name: '仕入管理', href: '/purchases', icon: TrendingUp },
  { name: '仕入伝票', href: '/purchase-orders', icon: FileText },
  { name: 'レポート', href: '/reports', icon: BarChart3 },
  { name: '設定', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
      <div className="hidden md: flex md:w-64 md:flex-col md:fixed md:inset-y-0"><div className="flex-1 flex flex-col min-h-0 bg-gray-900">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4 mb-8">
            <Package className="h-8 w-8 text-white" />
            <span className="ml-2 text-xl font-bold text-white">在庫管理システム</span>
          </div>
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    isActive
                      ? 'bg-gray-800 text-white'
      : 'text-gray-300 hover:bg-gray-700 hover:text-white' }`
                }
              >
                <item.icon
                  className="mr-3 flex-shrink-0 h-5 w-5"
                  aria-hidden="true"
                />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex-shrink-0 flex bg-gray-800 p-4">
          <div className="flex items-center">
            <div className="ml-3">
              <p className="text-sm font-medium text-white">在庫管理システム</p>
              <p className="text-xs text-gray-300">v1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};