import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-xl font-bold">Loading...</div>
    );
  }

  // If user is authenticated, go to dashboard, otherwise go to login
  return user ? <Navigate to="/app/dashboard" replace /> : <Navigate to="/login" replace />;
}
