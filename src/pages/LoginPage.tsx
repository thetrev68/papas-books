import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/GlobalToastProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, status } = useAuth();
  const { showError } = useToast();
  const navigate = useNavigate();

  // Redirect when user is authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/app/dashboard', { replace: true });
    }
  }, [status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      // Auth context will handle the rest via onAuthStateChange
      // Keep loading true until redirect happens
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign in';
      showError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50">
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Sign In</h1>
        <p className="text-lg text-neutral-600 mb-6">Welcome back. Let&apos;s get you in.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-neutral-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="mt-6 text-center space-y-2">
          <p>
            <Link to="/forgot-password" className="text-brand-700 font-bold hover:underline">
              Forgot Password?
            </Link>
          </p>
          <p className="text-neutral-600">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-brand-700 font-bold hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
