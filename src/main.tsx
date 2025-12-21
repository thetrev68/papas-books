import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GlobalToastProvider } from './components/GlobalToastProvider';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import ImportPage from './pages/ImportPage';
import WorkbenchPage from './pages/WorkbenchPage';
import ReconcilePage from './pages/ReconcilePage';
import ReportsPage from './pages/ReportsPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GlobalToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            <Route path="/app" element={<ProtectedRoute />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="workbench" element={<WorkbenchPage />} />
              <Route path="reconcile" element={<ReconcilePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="" element={<Navigate to="dashboard" replace />} />
            </Route>

            <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </GlobalToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
