import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';

// The dashboard pulls in the charting library, so keep it out of the login/register bundle
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LinkStats = lazy(() => import('./pages/LinkStats'));

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Suspense fallback={<div className="p-8 text-ink-soft">Loading...</div>}><Dashboard /></Suspense></ProtectedRoute>} />
          <Route path="/links/:id" element={<ProtectedRoute><Suspense fallback={<div className="p-8 text-ink-soft">Loading...</div>}><LinkStats /></Suspense></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
