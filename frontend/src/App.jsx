import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import ScrollToTop from './components/ScrollToTop';
import OfflineBanner from './components/OfflineBanner';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ErrorBoundary from './components/ErrorBoundary';
// Lazy-loaded pages for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Study = lazy(() => import('./pages/Study'));
const Notebooks = lazy(() => import('./pages/Notebooks'));
const Calendar = lazy(() => import('./pages/Calendar'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      <p className="text-xs text-on-surface-variant font-label uppercase tracking-[0.2em]">Loading...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <DataProvider>
          <Router>
            <ToastProvider>
              <ScrollToTop />
              <OfflineBanner />
              <Layout>
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Landing />} />
                      <Route path="/login" element={<Auth />} />
                      <Route path="/register" element={<Auth />} />
                      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                      <Route path="/study" element={<ProtectedRoute><Study /></ProtectedRoute>} />
                      <Route path="/notebooks" element={<ProtectedRoute><Notebooks /></ProtectedRoute>} />
                      <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </Layout>
            </ToastProvider>
          </Router>
        </DataProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;

