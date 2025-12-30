import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import PWAInstallPrompt from './PWAInstallPrompt';

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export default function AppLayout() {
  const { user, activeBookset, myBooksets, switchBookset, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Detect if app is installed as PWA
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is running in standalone mode (installed as PWA)
    const checkInstalled = () => {
      const isPWA =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as NavigatorWithStandalone).standalone === true;
      setIsInstalled(isPWA);
    };

    checkInstalled();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Don't navigate here - let the auth state change in AuthContext handle it
      // This prevents race conditions where we navigate before state clears
    } catch (error) {
      console.error('Error signing out:', error);
      // Only navigate on error to show error message
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navLinks = [
    {
      name: 'Dashboard',
      path: '/app/dashboard',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          ></path>
        </svg>
      ),
    },
    {
      name: 'Workbench',
      path: '/app/workbench',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          ></path>
        </svg>
      ),
    },
    {
      name: 'Import',
      path: '/app/import',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          ></path>
        </svg>
      ),
    },
    {
      name: 'Reconcile',
      path: '/app/reconcile',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
      ),
    },
    {
      name: 'Reports',
      path: '/app/reports',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          ></path>
        </svg>
      ),
    },
    {
      name: 'Settings',
      path: '/app/settings',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          ></path>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          ></path>
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-neutral-50 dark:bg-gray-900 text-neutral-800 dark:text-gray-100 font-sans">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Mobile Header - UPDATED with safe area support */}
      <div
        className={`bg-brand-700 dark:bg-brand-800 text-white p-4 flex justify-between items-center md:hidden shadow-lg sticky top-0 z-20 ${isInstalled ? 'pt-safe' : ''}`}
      >
        <h1 className="text-xl font-bold">Papa&apos;s Books</h1>
        <div className="flex gap-2">
          {myBooksets.length > 0 && (
            <select
              className="bg-white text-neutral-900 text-sm rounded border-none p-1"
              value={activeBookset?.id || ''}
              onChange={(e) => switchBookset(e.target.value)}
              aria-label="Switch bookset"
            >
              {myBooksets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs bg-brand-800 p-1 rounded"
            aria-label="Sign out"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Desktop Sidebar - UPDATED with version display */}
      <nav
        className="hidden md:flex flex-col w-72 bg-white dark:bg-gray-800 border-r border-neutral-200 dark:border-gray-700 h-screen sticky top-0 overflow-y-auto"
        aria-label="Main navigation"
      >
        <div className="p-6 bg-brand-700 dark:bg-brand-800 text-white">
          <h1 className="text-2xl font-bold">Papa&apos;s Books</h1>
          <p className="text-brand-100 mt-2 text-base">
            {user?.display_name || user?.email?.split('@')[0]}
          </p>

          <div className="mt-4">
            <label htmlFor="bookset-select" className="block text-brand-100 text-sm font-bold mb-1">
              Bookset
            </label>
            <select
              id="bookset-select"
              className="w-full bg-white dark:bg-gray-700 text-neutral-900 dark:text-gray-100 p-2 rounded border border-brand-600 dark:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800"
              value={activeBookset?.id || ''}
              onChange={(e) => switchBookset(e.target.value)}
              aria-label="Switch bookset"
            >
              {myBooksets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.owner_id === user?.id ? '' : '(Shared)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-2">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-4 p-4 rounded-xl font-bold transition-colors ${
                  active
                    ? 'bg-brand-50 dark:bg-brand-900 text-brand-900 dark:text-brand-100 border border-brand-200 dark:border-brand-700'
                    : 'text-neutral-600 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-gray-700 hover:text-neutral-900 dark:hover:text-gray-100'
                }`}
                aria-label={`Navigate to ${link.name}`}
                aria-current={active ? 'page' : undefined}
              >
                <div className={active ? 'text-brand-600' : 'text-neutral-500'} aria-hidden="true">
                  {link.icon}
                </div>
                {link.name}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-gray-700">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-4 p-4 w-full rounded-xl text-neutral-600 dark:text-gray-300 hover:bg-danger-50 dark:hover:bg-red-900 hover:text-danger-700 dark:hover:text-red-200 font-bold transition-colors"
            aria-label="Sign out of Papa's Books"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              ></path>
            </svg>
            Sign Out
          </button>

          {/* Version display */}
          <div className="mt-2 text-center">
            <p className="text-xs text-neutral-400">
              v{import.meta.env.VITE_APP_VERSION || '0.1.0'}
            </p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main
        id="main-content"
        className="flex-1 overflow-y-auto h-[calc(100vh-64px)] md:h-screen"
        role="main"
        aria-label="Main content"
      >
        <Outlet />
      </main>

      {/* Mobile Bottom Nav - UPDATED with safe area support */}
      <nav
        className="md:hidden sticky bottom-0 bg-white dark:bg-gray-800 border-t border-neutral-200 dark:border-gray-700 flex justify-around p-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20"
        aria-label="Mobile navigation"
      >
        {navLinks.slice(0, 5).map((link) => {
          const active = isActive(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex flex-col items-center p-2 touch-target ${active ? 'text-brand-600' : 'text-neutral-400'}`}
              aria-label={`Navigate to ${link.name}`}
              aria-current={active ? 'page' : undefined}
            >
              <div className="scale-75 origin-bottom" aria-hidden="true">
                {link.icon}
              </div>
              <span className="text-xs font-bold mt-1">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}
