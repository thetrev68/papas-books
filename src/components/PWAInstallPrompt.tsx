import { useState, useEffect } from 'react';
import type { BeforeInstallPromptEvent } from '../pwa';

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as NavigatorWithStandalone).standalone === true;

    if (isInstalled) {
      return; // Don't show prompt if already installed
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after user has had time to explore the app
      // This creates better engagement than showing immediately
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000); // 30 seconds after page load
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Hide our prompt and clear the deferred prompt
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleClosePrompt = () => {
    setShowPrompt(false);
    // Keep deferredPrompt so user can install later if they change their mind
  };

  // Don't render if no prompt to show
  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-white border border-brand-200 rounded-lg shadow-xl p-4 z-50 md:max-w-sm md:left-auto md:right-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg
            className="w-6 h-6 text-brand-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            ></path>
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-neutral-900">Install Papa&apos;s Books</h3>
          <p className="text-sm text-neutral-600 mt-1">
            Add to your home screen for quick access, offline support, and a native app experience.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors touch-target"
            >
              Install
            </button>
            <button
              onClick={handleClosePrompt}
              className="px-4 py-2 text-neutral-600 hover:text-neutral-900 transition-colors touch-target"
              aria-label="Dismiss install prompt"
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
