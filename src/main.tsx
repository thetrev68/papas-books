import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './pwa'; // Add PWA registration
import { initSentry } from './lib/sentry';

// Initialize error monitoring before React renders
initSentry();
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Suppress verbose Chrome performance warnings in development
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('[Violation]')) {
      return; // Suppress violation warnings
    }
    originalWarn.apply(console, args);
  };
}
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { GlobalToastProvider } from './components/GlobalToastProvider';
import ProtectedRoute from './components/ProtectedRoute';
import RootRedirect from './components/RootRedirect';
import { ErrorBoundary } from './components/ErrorBoundary';
import { queryClient } from './lib/queryClient';
import { LoadingSpinner } from './components/LoadingSpinner';

// Lazy load page components for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ConfirmEmailPage = lazy(() => import('./pages/ConfirmEmailPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const WorkbenchPage = lazy(() => import('./pages/WorkbenchPage'));
const ReconcilePage = lazy(() => import('./pages/ReconcilePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider>
          <BrowserRouter>
            <GlobalToastProvider>
              <AuthProvider>
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/auth/confirm" element={<ConfirmEmailPage />} />

                    <Route path="/app" element={<ProtectedRoute />}>
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="import" element={<ImportPage />} />
                      <Route path="workbench" element={<WorkbenchPage />} />
                      <Route path="reconcile" element={<ReconcilePage />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="" element={<Navigate to="dashboard" replace />} />
                    </Route>

                    <Route path="/" element={<RootRedirect />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </AuthProvider>
            </GlobalToastProvider>
          </BrowserRouter>
        </ThemeProvider>
      </ErrorBoundary>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </React.StrictMode>
);
