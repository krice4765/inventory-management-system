import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Package, 
  BarChart3, 
  Users, 
  Truck, 
  ShoppingCart, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

type MainLayoutProps = {
      children: React.ReactNode; };

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navigation = [
    { name: 'ダッシュボード', href: '/', icon: BarChart3 },
    { name: '商品管理', href: '/products', icon: Package },
    { name: '仕入先管理', href: '/suppliers', icon: Truck },
    { name: '得意先管理', href: '/customers', icon: Users },
    { name: '売上管理', href: '/sales', icon: ShoppingCart },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* モバイル用サイドバーオーバーレイ */}
      {sidebarOpen && (
      <div className="fixed inset-0 z-40 lg: hidden"><div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl">
            <SidebarContent 
              navigation={navigation} 
              location={location}
              onClose={() => setSidebarOpen(false)}
              user={user}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      )}

      {/* デスクトップ用サイドバー */}
      <div className="hidden lg: fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col"><SidebarContent 
          navigation={navigation} 
          location={location}
          user={user}
          onSignOut={handleSignOut}
        />
      </div>

      {/* メインコンテンツエリア */}
      <div className="lg: pl-64">{/* トップバー */}
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm: gap-x-6 sm:px-6 lg:px-8"><button
            type="button"
      className="-m-2.5 p-2.5 text-gray-700 lg: hidden"onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

      <div className="flex flex-1 gap-x-4 self-stretch lg: gap-x-6"><div className="flex items-center gap-x-4 lg: gap-x-6"><h1 className="text-lg font-semibold text-gray-900">
                在庫管理システム
              </h1>
            </div>
            
      <div className="flex items-center gap-x-4 lg: gap-x-6 ml-auto"><div className="flex items-center gap-x-2">
                <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm text-gray-700">
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ページコンテンツ */}
        <main className="py-4">
          {children}
        </main>
      </div>
    </div>
  );
};

// サイドバーコンテンツコンポーネント
type SidebarContentProps = {
      navigation: Array<{ name: string; href: string; icon: React.ComponentType<{ className?: string }>;
  }>;
  location: { pathname: string };
      onClose?: () => void; user: { email?: string } | null;
      onSignOut: () => void; };

const SidebarContent: React.FC<SidebarContentProps> = ({ 
  navigation, 
  location, 
  onClose,
  user,
  onSignOut 
}) => (
  <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-2 ring-1 ring-gray-200">
    <div className="flex h-16 shrink-0 items-center justify-between">
      <div className="flex items-center gap-x-2">
        <Package className="h-8 w-8 text-indigo-600" />
        <span className="text-lg font-semibold text-gray-900">在庫管理</span>
      </div>
      {onClose && (
        <button
          type="button"
      className="lg: hidden -m-2.5 p-2.5 text-gray-700"onClick={onClose}
        >
          <X className="h-6 w-6" />
        </button>
      )}
    </div>
    
    <nav className="flex flex-1 flex-col">
      <ul role="list" className="flex flex-1 flex-col gap-y-7">
        <li>
          <ul role="list" className="-mx-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600'
      : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600' }`}
                    onClick={onClose}
                  >
                    <item.icon className="h-6 w-6 shrink-0" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
        
        <li className="mt-auto">
          <div className="flex items-center gap-x-4 px-2 py-3 text-sm font-semibold leading-6 text-gray-900">
            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-xs">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 truncate">
              <div className="text-xs text-gray-500 truncate">
                {user?.email}
              </div>
            </div>
          </div>
          
          <button
            onClick={onSignOut}
      className="group flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover: bg-red-50 hover:text-red-600">
            <LogOut className="h-6 w-6 shrink-0" />
            ログアウト
          </button>
        </li>
      </ul>
    </nav>
  </div>
);