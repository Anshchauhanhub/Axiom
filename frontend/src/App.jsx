import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Study from './pages/Study';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Social from './pages/Social';
import ScrollToTop from './components/ScrollToTop';

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ToastProvider>
          <Router>
            <ScrollToTop />
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/study" element={<Study />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/social" element={<Social />} />
              </Routes>
            </Layout>
          </Router>
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
