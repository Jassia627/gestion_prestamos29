import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// Layouts
import Layout from '../components/layout/Layout';

// Auth Pages
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';

// Protected Pages
import Dashboard from '../pages/admin/Dashboard';
import Debtors from '../pages/admin/Debtors';
import Profile from '../pages/user/Profile';

// Lazy loaded components
import { lazy, Suspense } from 'react';
const Loans = lazy(() => import('../pages/admin/Loans'));
const Payments = lazy(() => import('../pages/admin/Payments'));
const Reports = lazy(() => import('../pages/admin/Reports'));

// Loading Component
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return children;
};

const AppRoutes = () => {
  const { currentUser } = useContext(AuthContext);

  // Redirigir a dashboard si el usuario está autenticado y trata de acceder a login/register
  if (currentUser && (window.location.pathname === '/login' || window.location.pathname === '/register')) {
    return <Navigate to="/" />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/debtors" element={
        <ProtectedRoute>
          <Layout>
            <Debtors />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/loans" element={
        <ProtectedRoute>
          <Layout>
            <Suspense fallback={<LoadingScreen />}>
              <Loans />
            </Suspense>
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/payments" element={
        <ProtectedRoute>
          <Layout>
            <Suspense fallback={<LoadingScreen />}>
              <Payments />
            </Suspense>
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute>
          <Layout>
            <Suspense fallback={<LoadingScreen />}>
              <Reports />
            </Suspense>
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <Layout>
            <Profile />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Catch all - 404 */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default AppRoutes;