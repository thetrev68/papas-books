import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/GlobalToastProvider';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      showSuccess('Account created! Please check your email for verification.');
      // Usually Supabase requires email verification by default, so we might not navigate immediately.
      // But for this phase let's assume auto-login or redirect to login.
      navigate('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign up';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 rounded-2xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-gray-100 mb-2">Sign Up</h1>
        <p className="text-lg text-neutral-600 dark:text-gray-400 mb-6">
          Create your account to get started.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign up form">
          <div>
            <label
              htmlFor="display-name"
              className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1"
            >
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:focus:ring-brand-900 outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="signup-email"
              className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1"
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              aria-required="true"
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:focus:ring-brand-900 outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="signup-password"
              className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1"
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              aria-required="true"
              className="w-full p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-700 dark:text-gray-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:focus:ring-brand-900 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <p className="text-neutral-600">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-700 font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
