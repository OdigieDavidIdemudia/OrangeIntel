import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoginScreen from './screens/LoginScreen';
import ThreatsView from './screens/ThreatsView';

import AdvisoryBuilder from './screens/AdvisoryBuilder';

import ReportBuilder from './screens/ReportBuilder';
import SettingsScreen from './screens/SettingsScreen';
import MonitoringScreen from './screens/MonitoringScreen';
import ThreatDashboard from './screens/ThreatDashboard';
import AdminDashboard from './screens/AdminDashboard';
import IocLookupScreen from './screens/IocLookupScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';

const RequireAuth = ({ children }) => {
  const { token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>; // Replace with a proper spinner if available
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const RequireAdmin = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  const isSuperAdmin = user?.roles?.includes('SuperAdmin');
  
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/privacy" element={<PrivacyPolicyScreen />} />
            <Route path="/login" element={<LoginScreen />} />

            <Route path="/" element={
              <RequireAuth>
                <MainLayout />
              </RequireAuth>
            }>
              <Route index element={<ThreatDashboard />} />
              <Route path="dashboard" element={<ThreatDashboard />} />

              <Route path="threats" element={<ThreatsView />} />
              <Route path="advisories" element={<Navigate to="/advisories/new" />} />
              <Route path="advisories/:id" element={<AdvisoryBuilder />} />

              <Route path="reports" element={<ReportBuilder />} />

              <Route path="ioc" element={<IocLookupScreen />} />

              <Route path="settings" element={<SettingsScreen />} />

              <Route path="admin" element={
                <RequireAdmin>
                  <AdminDashboard />
                </RequireAdmin>
              } />

              <Route path="*" element={<div>404 Not Found</div>} />
            </Route>

            <Route path="/monitor" element={
              <RequireAuth>
                <MonitoringScreen />
              </RequireAuth>
            } />
          </Routes>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--bg-panel)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              },
              success: {
                iconTheme: {
                  primary: 'var(--color-success)',
                  secondary: 'var(--bg-panel)',
                },
              },
              error: {
                iconTheme: {
                  primary: 'var(--color-danger)',
                  secondary: 'var(--bg-panel)',
                },
              },
            }}
          />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
