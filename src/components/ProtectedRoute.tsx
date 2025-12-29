import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from './AppLayout';

export default function ProtectedRoute() {
  const { user, status, error, retryAuth } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return (
      <div className="flex h-screen items-center justify-center text-xl font-bold">Loading...</div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="max-w-md p-8 bg-white rounded-2xl shadow-sm border border-neutral-200">
          <h2 className="text-2xl font-bold text-danger-700 mb-4">Authentication Error</h2>
          <p className="text-lg text-neutral-700 mb-6">{error?.message || 'Unknown error'}</p>
          <div className="flex gap-4">
            <button
              onClick={retryAuth}
              className="flex-1 px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700"
            >
              Retry
            </button>
            <button
              onClick={() => (window.location.href = '/login')}
              className="flex-1 px-6 py-3 bg-white border-2 border-neutral-300 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <AppLayout />;
}
