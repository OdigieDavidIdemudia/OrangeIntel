import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './components/layout/MainLayout';
import TopicsView from './screens/TopicsView';

import AdvisoryBuilder from './screens/AdvisoryBuilder';

import AssessmentBuilder from './screens/AssessmentBuilder';
import ReportBuilder from './screens/ReportBuilder';

import AdminDashboard from './screens/AdminDashboard';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/topics" replace />} />

            <Route path="topics" element={<TopicsView />} />
            <Route path="advisories" element={<Navigate to="/advisories/new" />} />
            <Route path="advisories/:id" element={<AdvisoryBuilder />} />

            <Route path="assessments" element={<AssessmentBuilder />} />
            <Route path="assessments/:id" element={<AssessmentBuilder />} />

            <Route path="reports" element={<ReportBuilder />} />

            <Route path="admin" element={<AdminDashboard />} />

            <Route path="*" element={<div>404 Not Found</div>} />
          </Route>
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
  );
}

export default App;
