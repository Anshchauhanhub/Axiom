import React from 'react';
import Landing from './pages/Landing';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Auth from './pages/Auth';
import Study from './pages/Study';
import Notebooks from './pages/Notebooks';

import Calendar from './pages/Calendar';
import ScrollToTop from './components/ScrollToTop';

import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <DataProvider>
          <Router>
            <ToastProvider>
              <ScrollToTop />
              <Layout>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/register" element={<Auth />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/study" element={<Study />} />
                  <Route path="/notebooks" element={<Notebooks />} />
                  <Route path="/calendar" element={<Calendar />} />

                </Routes>
              </Layout>
            </ToastProvider>
          </Router>
        </DataProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
