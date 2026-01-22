import { Routes, Route, Navigate } from 'react-router-dom';
import { TitleBar } from './components/TitleBar';
import { LoginPage } from './pages/LoginPage';
import { TPVPage } from './pages/TPVPage';
import { useAuthStore } from './stores/authStore';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/tpv" replace /> : <LoginPage />
            }
          />
          <Route
            path="/tpv"
            element={
              isAuthenticated ? <TPVPage /> : <Navigate to="/login" replace />
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
