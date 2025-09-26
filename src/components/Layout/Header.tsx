import React from 'react';
import { Bell, Search, User, LogOut, Database } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export const Header: React.FC = () => {
  const { user, signOut, hasValidCredentials } = useAuth();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('ログアウトに失敗しました');
    } else {
      // トーストはApp.tsxの認証リスナーで統一管理
      // toast.success('ログアウトしました');
    }
  };

  const handleConnectSupabase = () => {
    // This would typically open a modal or redirect to Supabase setup
    toast.info('Supabase接続機能は開発中です。.envファイルでSupabase認証情報を設定してください。');
  };

  return (
      <div className="md: pl-64 flex flex-col flex-1"><div className="sticky top-0 z-10 md: hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-100"><button
          type="button"
      className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover: text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
          <span className="sr-only">Open sidebar</span>
        </button>
      </div>
      <main className="flex-1">
        <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm: px-6 md:px-8"><div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="relative max-w-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus: outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"placeholder="商品検索..."
                  />
                </div>
              </div>
      <div className="ml-4 flex items-center md: ml-6">{!hasValidCredentials && (
                  <button
                    onClick={handleConnectSupabase}
      className="mr-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover: bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <Database className="h-4 w-4 mr-2" />
                    Connect to Supabase
                  </button>
                )}
                <button
                  type="button"
      className="bg-white p-1 rounded-full text-gray-400 hover: text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <span className="sr-only">View notifications</span>
                  <Bell className="h-6 w-6" />
                </button>

                <div className="ml-3 relative">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <User className="h-8 w-8 rounded-full bg-gray-300 p-1" />
                      <span className="text-sm font-medium text-gray-700">
                        {user?.email}
                      </span>
                    </div>
                    <button
                      onClick={handleSignOut}
      className="bg-white p-1 rounded-full text-gray-400 hover: text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};