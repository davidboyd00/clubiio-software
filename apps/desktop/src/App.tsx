import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TitleBar } from './components/TitleBar';
import { MainLayout } from './components/layout';
import { LoginPage } from './pages/LoginPage';
import { OpenCashPage } from './pages/OpenCashPage';
import { POSPage } from './pages/POSPage';
import { CloseCashPage } from './pages/CloseCashPage';
import { CashMovementsPage } from './pages/CashMovementsPage';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductManagementPage } from './pages/ProductManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { CustomerManagementPage } from './pages/CustomerManagementPage';
import { CategoryManagementPage } from './pages/CategoryManagementPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { StockAlertsPage } from './pages/StockAlertsPage';
import StaffManagementPage from './pages/StaffManagementPage';
import PermissionsPage from './pages/PermissionsPage';
import AIAssistantPage from './pages/AIAssistantPage';
import { EventsPage } from './pages/EventsPage';
import { TicketsPage } from './pages/TicketsPage';
import { VipCardsPage } from './pages/VipCardsPage';
import { VipTablesPage } from './pages/VipTablesPage';
import { AccessControlPage } from './pages/AccessControlPage';
import { WarehousesPage } from './pages/WarehousesPage';
import { useAuthStore } from './stores/authStore';

// Route protection component
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Require cash session component
function RequireSession({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, cashSessionId } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!cashSessionId) {
    return <Navigate to="/open-cash" replace />;
  }

  return <>{children}</>;
}

// Redirect if already has session
function RedirectIfSession({ children }: { children: React.ReactNode }) {
  const { cashSessionId } = useAuthStore();

  if (cashSessionId) {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          {/* Public route */}
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/open-cash" replace /> : <LoginPage />
            }
          />

          {/* Auth required, no session required */}
          <Route
            path="/open-cash"
            element={
              <RequireAuth>
                <RedirectIfSession>
                  <OpenCashPage />
                </RedirectIfSession>
              </RequireAuth>
            }
          />

          {/* Session required routes with sidebar */}
          <Route
            element={
              <RequireSession>
                <MainLayout />
              </RequireSession>
            }
          >
            <Route path="/pos" element={<POSPage />} />
            <Route path="/history" element={<OrderHistoryPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/movements" element={<CashMovementsPage />} />
            <Route path="/products" element={<ProductManagementPage />} />
            <Route path="/categories" element={<CategoryManagementPage />} />
            <Route path="/customers" element={<CustomerManagementPage />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/stock-alerts" element={<StockAlertsPage />} />
            <Route path="/staff" element={<StaffManagementPage />} />
            <Route path="/permissions" element={<PermissionsPage />} />
            <Route path="/ai" element={<AIAssistantPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/vip-cards" element={<VipCardsPage />} />
            <Route path="/vip-tables" element={<VipTablesPage />} />
            <Route path="/access-control" element={<AccessControlPage />} />
            <Route path="/warehouses" element={<WarehousesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/close-cash" element={<CloseCashPage />} />
          </Route>

          {/* Legacy route redirects */}
          <Route path="/tpv" element={<Navigate to="/pos" replace />} />

          {/* Default redirect */}
          <Route
            path="*"
            element={
              isAuthenticated ? (
                <Navigate to="/open-cash" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
