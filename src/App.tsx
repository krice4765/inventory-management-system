import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { useEffect, Suspense } from 'react';
import { supabase } from './lib/supabase';
import { useDarkMode } from './hooks/useDarkMode';
import Sidebar from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LazyLoadingSpinner } from './components/LazyLoadingSpinner';

// 高優先度コンポーネント（同期インポート）
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

// 遅延ローディングコンポーネント
import * as LazyComponents from './utils/lazyComponents';

function App() {
  const { user, setUser, loading, setLoading } = useAuthStore();
  const { isDark: _isDark } = useDarkMode();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="lg:pl-64">
          <main className="min-h-screen">
            <ErrorBoundary>
              <Routes>
                {/* 高優先度ルート（同期ローディング） */}
                <Route path="/" element={<Dashboard />} />
                
                {/* 中優先度ルート（遅延ローディング） */}
                <Route 
                  path="/products" 
                  element={
                    <Suspense fallback={<LazyLoadingSpinner message="商品管理を読み込み中..." />}>
                      <LazyComponents.Products />
                    </Suspense>
                  } 
                />
                
                <Route 
                  path="/inventory" 
                  element={
                    <Suspense fallback={<LazyLoadingSpinner message="在庫管理を読み込み中..." />}>
                      <LazyComponents.Inventory />
                    </Suspense>
                  } 
                />
                
                <Route 
                  path="/orders" 
                  element={
                    <Suspense fallback={<LazyLoadingSpinner message="受注管理を読み込み中..." />}>
                      <LazyComponents.Orders />
                    </Suspense>
                  } 
                />
                
                {/* 低優先度ルート（遅延ローディング） */}
                <Route 
                  path="/partners" 
                  element={
                    <Suspense fallback={<LazyLoadingSpinner message="取引先管理を読み込み中..." />}>
                      <LazyComponents.Partners />
                    </Suspense>
                  } 
                />
                
                <Route 
                  path="/purchase-orders" 
                  element={
                    <Suspense fallback={<LazyLoadingSpinner message="発注管理を読み込み中..." />}>
                      <LazyComponents.PurchaseOrders />
                    </Suspense>
                  } 
                />
                
                <Route 
                  path="/purchase-orders/:id" 
                  element={
                    <Suspense fallback={<LazyLoadingSpinner message="発注詳細を読み込み中..." />}>
                      <LazyComponents.PurchaseOrderDetail />
                    </Suspense>
                  } 
                />
                
                <Route 
                  path="/orders/:id" 
                  element={
                    <Suspense fallback={<LazyLoadingSpinner message="受注詳細を読み込み中..." />}>
                      <LazyComponents.OrderDetail />
                    </Suspense>
                  } 
                />
                
                <Route 
                  path="/orders/new" 
                  element={
                    <Suspense fallback={<LazyLoadingSpinner message="新規受注画面を読み込み中..." />}>
                      <LazyComponents.OrderNew />
                    </Suspense>
                  } 
                />
                
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      
      {/* DeliveryModalも遅延ローディング対象 */}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <LazyComponents.DeliveryModal />
        </Suspense>
      </ErrorBoundary>
      
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </Router>
  );
}

export default App;