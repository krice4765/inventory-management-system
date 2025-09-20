import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
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
    // 🔧 無効なリフレッシュトークンエラーを自動修復
    const handleSessionRecovery = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error?.message?.includes('Invalid Refresh Token')) {
          console.warn('🔄 無効なセッションを検出、クリアしています...');

          // Supabaseセッションのクリア
          await supabase.auth.signOut();

          // ローカルストレージからSupabase関連キーを削除
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-')) {
              localStorage.removeItem(key);
            }
          });

          setUser(null);
          setLoading(false);
          return;
        }

        setUser(session?.user ?? null);
        setLoading(false);
      } catch (sessionError) {
        console.error('セッション復旧エラー:', sessionError);
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
      }
    };

    handleSessionRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      // 認証イベントのトースト表示（統一管理）
      if (event === 'SIGNED_OUT') {
        toast.success('ログアウトしました。');
      }
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

  return (
    <Router>
      <Routes>
        {/* 認証不要な公開ルート */}
        <Route path="/login" element={<Login />} />
        <Route
          path="/user-application"
          element={
            <Suspense fallback={<LazyLoadingSpinner message="申請フォームを読み込み中..." />}>
              <LazyComponents.UserApplication />
            </Suspense>
          }
        />

        {/* 認証が必要な保護されたルート */}
        <Route
          path="/*"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : (
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

                        {/* 管理・監視ルート */}
                        <Route
                          path="/performance"
                          element={
                            <Suspense fallback={<LazyLoadingSpinner message="パフォーマンス監視を読み込み中..." />}>
                              <LazyComponents.PerformanceDashboard />
                            </Suspense>
                          }
                        />

                        <Route
                          path="/integrity"
                          element={
                            <Suspense fallback={<LazyLoadingSpinner message="データ整合性チェックを読み込み中..." />}>
                              <LazyComponents.IntegrityDashboard />
                            </Suspense>
                          }
                        />

                        {/* 整合性管理統合画面 */}
                        <Route
                          path="/integrity-management"
                          element={
                            <Suspense fallback={<LazyLoadingSpinner message="整合性管理を読み込み中..." />}>
                              <LazyComponents.IntegrityManagement />
                            </Suspense>
                          }
                        />

                        {/* ユーザー管理システム */}
                        <Route
                          path="/user-management"
                          element={
                            <Suspense fallback={<LazyLoadingSpinner message="ユーザー管理を読み込み中..." />}>
                              <LazyComponents.UserManagement />
                            </Suspense>
                          }
                        />

                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </ErrorBoundary>
                  </main>
                </div>
              </div>
            )
          }
        />
      </Routes>

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