// src/pwa.ts
import { registerSW } from 'virtual:pwa-register';

// Define the BeforeInstallPrompt event type
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Register the service worker
const updateSW = registerSW({
  onNeedRefresh() {
    // Log update availability - integrate with toast system if needed
    console.log('New version available! Please refresh the page.');

    // Optional: Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification("Papa's Books Update", {
        body: 'A new version is available. Refresh to update.',
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
      });
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline!');
  },
  onRegisterError(error) {
    console.error('Service worker registration failed:', error);
  },
});

// Check for updates on visibility change (more efficient than interval)
if ('serviceWorker' in navigator) {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateSW(true);
    }
  });
}

export { updateSW };
