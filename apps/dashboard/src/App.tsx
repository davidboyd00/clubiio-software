import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { useSuperAdminStore } from './stores/superAdmin.store';
import DashboardLayout from './components/layout/DashboardLayout';
import AdminLayout from './components/layout/AdminLayout';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import SalesPage from './pages/SalesPage';
import ProductsPage from './pages/ProductsPage';
import StaffPage from './pages/StaffPage';
import VenuesPage from './pages/VenuesPage';
import SettingsPage from './pages/SettingsPage';
import FestivalModePage from './pages/FestivalModePage';

// Super Admin Pages
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminTenantsPage from './pages/admin/AdminTenantsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminPrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSuperAdminStore();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Tenant Dashboard Routes */}
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="venues" element={<VenuesPage />} />
        <Route path="festival" element={<FestivalModePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Super Admin Routes */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminPrivateRoute>
            <AdminLayout />
          </AdminPrivateRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="tenants" element={<AdminTenantsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
