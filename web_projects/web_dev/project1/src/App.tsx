import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { useEffect, lazy, Suspense } from 'react';
import { supabase } from './lib/supabase';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { DeliveryModal } from './components/DeliveryModal';
import AdminRoute from './components/AdminRoute';
// Temporarily import OrderNew directly to debug
import OrderNew from './pages/OrderNew';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Lazy load heavy components for code splitting
const Products = lazy(() => import('./pages/Products'));
const Inventory = lazy(() => import('./pages/Inventory'));
const InventoryAdjustment = lazy(() => import('./pages/InventoryAdjustment'));
const Partners = lazy(() => import('./pages/Partners'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Orders = lazy(() => import('./pages/Orders'));
const AccountsPayable = lazy(() => import('./pages/AccountsPayable'));
const AccountsPayableLedger = lazy(() => import('./pages/AccountsPayableLedger'));
const PaymentSchedule = lazy(() => import('./pages/PaymentSchedule'));
const PaymentNew = lazy(() => import('./pages/PaymentNew'));
const Payments = lazy(() => import('./pages/Payments'));
const PaymentDashboard = lazy(() => import('./pages/PaymentDashboard'));
const SalesOrders = lazy(() => import('./pages/SalesOrders'));
const SalesOrderNew = lazy(() => import('./pages/SalesOrderNew'));
const SalesOrderDetail = lazy(() => import('./pages/SalesOrderDetail'));
const PurchaseOrderDetail = lazy(() => import('./pages/PurchaseOrderDetail'));
const TransactionDetail = lazy(() => import('./pages/TransactionDetail'));
const AccountsReceivable = lazy(() => import('./pages/AccountsReceivable'));
const AccountsReceivableLedger = lazy(() => import('./pages/AccountsReceivableLedger'));
const SalesTransactionNew = lazy(() => import('./pages/SalesTransactionNew'));
const ReceiptNew = lazy(() => import('./pages/ReceiptNew'));

// Lazy load report pages (heavy components with charts)
const PayableReport = lazy(() => import('./pages/PayableReport'));
const PaymentHistoryReport = lazy(() => import('./pages/PaymentHistoryReport'));
const ReceivableReport = lazy(() => import('./pages/ReceivableReport'));
const ReceiptHistoryReport = lazy(() => import('./pages/ReceiptHistoryReport'));
const InventoryReport = lazy(() => import('./pages/InventoryReport'));
const InventoryMovementReport = lazy(() => import('./pages/InventoryMovementReport'));

// Lazy load admin pages
const UserManagement = lazy(() => import('./pages/UserManagement'));
const CompanySettings = lazy(() => import('./pages/CompanySettings'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  const { user, setUser, setUserProfile, loading, setLoading } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      if (cancelled) return;

      console.log('[App] Starting session initialization...');

      try {
        // 回避策: LocalStorageから直接セッションを読み取る
        const storageKey = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
        const storedSession = localStorage.getItem(storageKey);

        let session = null;

        if (storedSession) {
          try {
            const parsed = JSON.parse(storedSession);
            // トークンが有効期限内かチェック
            if (parsed.expires_at && parsed.expires_at > Date.now() / 1000) {
              console.log('[App] Using session from localStorage');
              // Supabase User オブジェクトを再構築
              session = {
                user: {
                  id: parsed.user?.id,
                  email: parsed.user?.email,
                  user_metadata: parsed.user?.user_metadata,
                  app_metadata: parsed.user?.app_metadata,
                  aud: parsed.user?.aud,
                  created_at: parsed.user?.created_at,
                },
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token,
              };
            } else {
              console.log('[App] Stored session expired');
            }
          } catch (e) {
            console.error('[App] Failed to parse stored session:', e);
          }
        }

        if (cancelled) return;

        console.log('[App] Got session:', session ? 'User logged in' : 'No user');
        setUser(session?.user ?? null);

        // ユーザープロファイルを取得（直接fetch使用、access_tokenで認証）
        if (session?.user && session?.access_token) {
          console.log('[App] Fetching user profile for:', session.user.id);

          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${session.user.id}&select=*`,
              {
                headers: {
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${session.access_token}`,
                },
              }
            );

            if (cancelled) return;

            if (response.ok) {
              const profiles = await response.json();
              const profile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;

              if (profile) {
                console.log('[App] User profile loaded:', profile);
                setUserProfile(profile);
              } else {
                console.warn('[App] No profile found for user');
              }
            } else {
              console.error('[App] Failed to load user profile:', response.status);
            }
          } catch (error) {
            console.warn('[App] Profile fetch failed:', error);
            // プロファイルなしで続行
          }
        }

        console.log('[App] Session initialization complete');
      } catch (error) {
        if (!cancelled) {
          console.error('[App] Failed to initialize auth:', error);
        }
      } finally {
        if (!cancelled) {
          console.log('[App] Setting loading to false');
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;

      try {
        setUser(session?.user ?? null);

        // ユーザープロファイルを取得（直接fetch使用、access_tokenで認証）
        if (session?.user && session?.access_token) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${session.user.id}&select=*`,
              {
                headers: {
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${session.access_token}`,
                },
              }
            );

            if (!cancelled && response.ok) {
              const profiles = await response.json();
              const profile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;

              if (profile) {
                setUserProfile(profile);
              }
            }
          } catch (error) {
            if (!cancelled) {
              console.error('Failed to load user profile:', error);
            }
          }
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error during auth state change:', error);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setUser, setUserProfile, setLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <Toaster position="top-right" />
        </Router>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Sidebar />
          <div className="pl-64">
            <main className="p-8">
              <Routes>
                {/* Dashboard is not lazy-loaded, so it doesn't need Suspense */}
                <Route path="/" element={<Dashboard />} />

                {/* OrderNew is not lazy-loaded */}
                <Route path="/orders/new" element={<OrderNew />} />

                {/* Lazy-loaded routes wrapped in Suspense */}
                <Route path="/products" element={<Suspense fallback={<LoadingFallback />}><Products /></Suspense>} />
                <Route path="/inventory" element={<Suspense fallback={<LoadingFallback />}><Inventory /></Suspense>} />
                <Route path="/inventory/adjust/:productId" element={<Suspense fallback={<LoadingFallback />}><InventoryAdjustment /></Suspense>} />
                <Route path="/partners" element={<Suspense fallback={<LoadingFallback />}><Partners /></Suspense>} />
                <Route path="/purchase-orders" element={<Suspense fallback={<LoadingFallback />}><PurchaseOrders /></Suspense>} />
                <Route path="/purchase-orders/:id" element={<Suspense fallback={<LoadingFallback />}><PurchaseOrderDetail /></Suspense>} />
                <Route path="/transactions/:id" element={<Suspense fallback={<LoadingFallback />}><TransactionDetail /></Suspense>} />
                <Route path="/orders" element={<Suspense fallback={<LoadingFallback />}><Orders /></Suspense>} />
                <Route path="/orders/:id" element={<Suspense fallback={<LoadingFallback />}><PurchaseOrderDetail /></Suspense>} />
                <Route path="/accounts-payable" element={<Suspense fallback={<LoadingFallback />}><AccountsPayable /></Suspense>} />
                <Route path="/accounts-payable-ledger" element={<Suspense fallback={<LoadingFallback />}><AccountsPayableLedger /></Suspense>} />
                <Route path="/payment-schedule" element={<Suspense fallback={<LoadingFallback />}><PaymentSchedule /></Suspense>} />
                <Route path="/payment/new" element={<Suspense fallback={<LoadingFallback />}><PaymentNew /></Suspense>} />
                <Route path="/payments" element={<Suspense fallback={<LoadingFallback />}><Payments /></Suspense>} />
                <Route path="/payment-dashboard" element={<Suspense fallback={<LoadingFallback />}><PaymentDashboard /></Suspense>} />
                <Route path="/sales-orders" element={<Suspense fallback={<LoadingFallback />}><SalesOrders /></Suspense>} />
                <Route path="/sales-orders/new" element={<Suspense fallback={<LoadingFallback />}><SalesOrderNew /></Suspense>} />
                <Route path="/sales-orders/:id" element={<Suspense fallback={<LoadingFallback />}><SalesOrderDetail /></Suspense>} />
                <Route path="/sales-transactions/new" element={<Suspense fallback={<LoadingFallback />}><SalesTransactionNew /></Suspense>} />
                <Route path="/accounts-receivable" element={<Suspense fallback={<LoadingFallback />}><AccountsReceivable /></Suspense>} />
                <Route path="/accounts-receivable-ledger" element={<Suspense fallback={<LoadingFallback />}><AccountsReceivableLedger /></Suspense>} />
                <Route path="/receipt/new" element={<Suspense fallback={<LoadingFallback />}><ReceiptNew /></Suspense>} />
                <Route path="/reports/payable" element={<Suspense fallback={<LoadingFallback />}><PayableReport /></Suspense>} />
                <Route path="/reports/payment-history" element={<Suspense fallback={<LoadingFallback />}><PaymentHistoryReport /></Suspense>} />
                <Route path="/reports/receivable" element={<Suspense fallback={<LoadingFallback />}><ReceivableReport /></Suspense>} />
                <Route path="/reports/receipt-history" element={<Suspense fallback={<LoadingFallback />}><ReceiptHistoryReport /></Suspense>} />
                <Route path="/reports/inventory" element={<Suspense fallback={<LoadingFallback />}><InventoryReport /></Suspense>} />
                <Route path="/reports/inventory-movement" element={<Suspense fallback={<LoadingFallback />}><InventoryMovementReport /></Suspense>} />

                {/* Admin routes */}
                <Route path="/admin/users" element={<Suspense fallback={<LoadingFallback />}><AdminRoute><UserManagement /></AdminRoute></Suspense>} />
                <Route path="/admin/company-settings" element={<Suspense fallback={<LoadingFallback />}><AdminRoute><CompanySettings /></AdminRoute></Suspense>} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
        <DeliveryModal />
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
    </QueryClientProvider>
  );
}

export default App;
