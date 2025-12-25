# PWA Implementation Plan - Papa's Books (Haiku Optimized)

**AI Agent Instructions:** This plan is optimized for step-by-step execution. Follow each step exactly as written. Complete file contents are provided where needed - look for "COMPLETE FILE" markers.

**Estimated Time:** 3-4 hours
**Prerequisites:** Node.js, npm, existing Papa's Books project running

---

## Phase 0: Automatic Versioning Setup

### Step 0.1: Install Versioning Dependencies

Run this command:

```bash
npm install -D standard-version
```

**Expected output:** Package installed successfully.

### Step 0.2: Add Version Scripts to package.json

**Action:** Edit [package.json](package.json)

Add these four lines to the `"scripts"` section (after the existing scripts):

```json
"release": "standard-version",
"release:minor": "standard-version --release-as minor",
"release:major": "standard-version --release-as major",
"release:patch": "standard-version --release-as patch"
```

**Result:** package.json should have these new scripts available.

### Step 0.3: Configure Version Management

**Action:** Create new file `.versionrc.json` in the root directory

**COMPLETE FILE CONTENTS:**

```json
{
  "types": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "chore", "hidden": false, "section": "Maintenance" },
    { "type": "docs", "hidden": false, "section": "Documentation" },
    { "type": "style", "hidden": true },
    { "type": "refactor", "section": "Code Improvements" },
    { "type": "perf", "section": "Performance" },
    { "type": "test", "hidden": true }
  ],
  "commitUrlFormat": "{{host}}/{{owner}}/{{repository}}/commit/{{hash}}",
  "compareUrlFormat": "{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}",
  "issueUrlFormat": "{{host}}/{{owner}}/{{repository}}/issues/{{id}}",
  "userUrlFormat": "{{host}}/{{user}}",
  "releaseCommitMessageFormat": "chore(release): {{currentTag}}",
  "issuePrefixes": ["#"]
}
```

### Step 0.4: Update vite.config.ts for Version Display

**Action:** Replace [vite.config.ts](vite.config.ts) completely

**COMPLETE FILE CONTENTS:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir: '.vite-cache',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
  },
});
```

**What changed:** Added version injection from package.json.

---

## Phase 1: PWA Infrastructure Setup

### Step 1.1: Install PWA Plugin

Run this command:

```bash
npm install -D vite-plugin-pwa
```

**Expected output:** Package installed successfully.

### Step 1.2: Create PWA Registration Module

**Action:** Create new file `src/pwa.ts`

**COMPLETE FILE CONTENTS:**

```typescript
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
```

### Step 1.3: Update Main Entry Point

**Action:** Edit [src/main.tsx](src/main.tsx)

**Change:** Add this import after `import './index.css';`:

```typescript
import './pwa'; // Add PWA registration
```

**Result:** The top of main.tsx should look like:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './pwa'; // <- NEW LINE
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
```

### Step 1.4: Configure Vite for PWA

**Action:** Replace [vite.config.ts](vite.config.ts) completely

**COMPLETE FILE CONTENTS:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

// PWA Configuration
const pwaConfig = {
  registerType: 'autoUpdate' as const,
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon-16x16.png', 'favicon-32x32.png'],
  manifest: {
    name: "Papa's Books",
    short_name: "Papa's Books",
    description: 'Personal Finance & Bookkeeping Application',
    theme_color: '#0369a1', // brand-700 from tailwind.config.js
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait-primary',
    scope: '/',
    start_url: '/',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    // Don't cache API calls - always use network for Supabase
    navigateFallbackDenylist: [/^\/api/, /^\/auth/],
    runtimeCaching: [
      {
        // Cache Google Fonts CSS
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Google Fonts files
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Network-first for Supabase API calls (ensures fresh auth tokens)
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api',
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 5, // 5 minutes
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA(pwaConfig)],
  cacheDir: '.vite-cache',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
  },
});
```

**Key points:**

- Uses `#0369a1` theme color (matches existing brand-700)
- NetworkFirst for Supabase API (keeps auth tokens fresh)
- CacheFirst for fonts (performance)

### Step 1.5: Update HTML Meta Tags

**Action:** Replace [index.html](index.html) completely

**COMPLETE FILE CONTENTS:**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0369a1" />
    <meta name="description" content="Personal Finance & Bookkeeping Application" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Papa's Books" />

    <title>Papa's Books</title>

    <!-- Favicon and icons -->
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Key changes:**

- `viewport-fit=cover` for iPhone notch support
- `theme-color: #0369a1` matches brand color
- iOS-specific meta tags for standalone mode

### Step 1.6: Delete Old Manifest File

Run this command:

```bash
rm site.webmanifest
```

**Why:** vite-plugin-pwa will auto-generate manifest.webmanifest.

---

## Phase 2: Mobile UI Optimization

### Step 2.1: Add Safe Area Support CSS

**Action:** Replace [src/index.css](src/index.css) completely

**COMPLETE FILE CONTENTS:**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply font-sans text-neutral-800 antialiased bg-neutral-50;
    font-size: 18px;
    line-height: 1.75rem;

    /* Ensure proper viewport height on mobile */
    min-height: 100vh;
    min-height: 100dvh; /* Dynamic viewport height for mobile browsers */
  }
}

/* Safe area utilities for devices with notches */
@layer utilities {
  .pb-safe {
    padding-bottom: max(env(safe-area-inset-bottom), 0.5rem);
  }

  .pt-safe {
    padding-top: max(env(safe-area-inset-top), 0.5rem);
  }

  .pl-safe {
    padding-left: max(env(safe-area-inset-left), 1rem);
  }

  .pr-safe {
    padding-right: max(env(safe-area-inset-right), 1rem);
  }
}

/* Prevent zoom on form inputs (iOS Safari) */
input[type='text'],
input[type='email'],
input[type='password'],
input[type='number'],
input[type='date'],
textarea,
select {
  font-size: 16px; /* Prevents iOS zoom on focus */
}

/* Improve touch targets - minimum 44x44px for accessibility */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* PWA-specific styles */
#root {
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
}

/* Smooth scrolling for better UX */
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}

/* Hide scrollbar on mobile but keep functionality */
@media (max-width: 768px) {
  ::-webkit-scrollbar {
    display: none;
  }

  * {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}

/* Remove default input styling on mobile */
input,
select,
textarea {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
```

**What this adds:**

- Safe area utilities (.pb-safe, .pt-safe, etc.)
- Prevents iOS zoom on inputs
- Touch target sizing
- Mobile-friendly scrolling

### Step 2.2: Update AppLayout Component

**Action:** Replace [src/components/AppLayout.tsx](src/components/AppLayout.tsx) completely

**COMPLETE FILE CONTENTS:**

```typescript
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';

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
        (window.navigator as any).standalone === true;
      setIsInstalled(isPWA);
    };

    checkInstalled();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
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
    <div className="min-h-screen flex flex-col md:flex-row bg-neutral-50 text-neutral-800 font-sans">
      {/* Mobile Header - UPDATED with safe area support */}
      <div className={`bg-brand-700 text-white p-4 flex justify-between items-center md:hidden shadow-lg sticky top-0 z-20 ${isInstalled ? 'pt-safe' : ''}`}>
        <h1 className="text-xl font-bold">Papa&apos;s Books</h1>
        <div className="flex gap-2">
          {myBooksets.length > 0 && (
            <select
              className="bg-white text-neutral-900 text-sm rounded border-none p-1"
              value={activeBookset?.id || ''}
              onChange={(e) => switchBookset(e.target.value)}
            >
              {myBooksets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <button onClick={handleSignOut} className="text-xs bg-brand-800 p-1 rounded">
            Sign Out
          </button>
        </div>
      </div>

      {/* Desktop Sidebar - UPDATED with version display */}
      <nav className="hidden md:flex flex-col w-72 bg-white border-r border-neutral-200 h-screen sticky top-0 overflow-y-auto">
        <div className="p-6 bg-brand-700 text-white">
          <h1 className="text-2xl font-bold">Papa&apos;s Books</h1>
          <p className="text-brand-100 mt-2 text-base">
            {user?.display_name || user?.email?.split('@')[0]}
          </p>

          <div className="mt-4">
            <label className="block text-brand-100 text-sm font-bold mb-1">Bookset</label>
            <select
              className="w-full bg-white text-neutral-900 p-2 rounded border border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
              value={activeBookset?.id || ''}
              onChange={(e) => switchBookset(e.target.value)}
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
                    ? 'bg-brand-50 text-brand-900 border border-brand-200'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <div className={active ? 'text-brand-600' : 'text-neutral-500'}>{link.icon}</div>
                {link.name}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-neutral-200">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-4 p-4 w-full rounded-xl text-neutral-600 hover:bg-danger-50 hover:text-danger-700 font-bold transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <main className="flex-1 overflow-y-auto h-[calc(100vh-64px)] md:h-screen">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav - UPDATED with safe area support */}
      <nav className="md:hidden sticky bottom-0 bg-white border-t border-neutral-200 flex justify-around p-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
        {navLinks.slice(0, 5).map((link) => {
          const active = isActive(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex flex-col items-center p-2 touch-target ${active ? 'text-brand-600' : 'text-neutral-400'}`}
            >
              <div className="scale-75 origin-bottom">{link.icon}</div>
              <span className="text-xs font-bold mt-1">{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

**Key changes:**

- Added PWA detection (useState/useEffect)
- Mobile header uses `pt-safe` when installed
- Desktop sidebar shows version
- Mobile nav uses `pb-safe` and `.touch-target`

### Step 2.3: Create PWA Install Prompt Component

**Action:** Create new file `src/components/PWAInstallPrompt.tsx`

**COMPLETE FILE CONTENTS:**

```typescript
import { useState, useEffect } from 'react';
import type { BeforeInstallPromptEvent } from '../pwa';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

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
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
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
```

### Step 2.4: Add Install Prompt to AppLayout

**Action:** Edit [src/components/AppLayout.tsx](src/components/AppLayout.tsx)

**Change 1:** Add import at the top (after existing imports):

```typescript
import PWAInstallPrompt from './PWAInstallPrompt';
```

**Change 2:** Add component before the closing `</div>` tag at the very end of the file.

Find this line (currently line 222):

```typescript
      </nav>
    </div>  // <- This is the LAST closing div
  );
}
```

Change it to:

```typescript
      </nav>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}
```

---

## Phase 3: TypeScript Type Definitions

### Step 3.1: Add PWA Type Declarations

**Action:** Create new file `src/vite-env.d.ts`

**COMPLETE FILE CONTENTS:**

```typescript
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_VERSION: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Phase 4: Testing & Validation

### Step 4.1: Build and Test Locally

Run these commands in sequence:

```bash
# Clean previous builds
rm -rf dist

# Build for production
npm run build

# Preview production build
npm run preview
```

**Important:** Service workers only work in production builds. The preview command serves the built app at <http://localhost:4173>.

### Step 4.2: Test Checklist

Open <http://localhost:4173> in Chrome/Edge and verify:

1. ✅ Open DevTools → Application tab
2. ✅ Check "Manifest" section - should show Papa's Books details
3. ✅ Check "Service Workers" section - should show registered worker
4. ✅ Go offline (DevTools → Network → Offline)
5. ✅ Refresh page - app should still load (cached)
6. ✅ Go back online
7. ✅ Wait 30 seconds - install prompt should appear

### Step 4.3: Lighthouse PWA Audit

1. Open <http://localhost:4173>
2. DevTools (F12) → Lighthouse tab
3. Select "Progressive Web App" category
4. Click "Analyze page load"
5. **Target score:** 90+ for PWA category

### Step 4.4: Test Versioning

Run these commands:

```bash
# Make a test change
git add .
git commit -m "feat(pwa): implement PWA infrastructure"

# Create release
npm run release

# Verify
cat CHANGELOG.md
grep version package.json
```

**Expected results:**

- Version bumped in package.json
- CHANGELOG.md created/updated
- Git tag created
- Version displays in app sidebar

---

## Phase 5: Production Deployment

### Step 5.1: Build for Production

```bash
npm run build
```

**Output:** `dist/` folder with optimized files ready to deploy.

### Step 5.2: Deploy to Server

1. Upload entire `dist/` folder contents to your web server
2. Ensure server has HTTPS enabled (required for PWA)
3. Configure server to serve service worker with no-cache headers
4. Configure SPA routing (all routes → index.html)

### Step 5.3: Verify Production Deployment

1. Visit production URL on mobile device
2. Verify HTTPS (green lock icon)
3. Wait for install prompt
4. Install app to home screen
5. Open from home screen (should be standalone mode)
6. Test offline (airplane mode)

---

## Quick Reference: Useful Commands

### Development

```bash
npm run dev              # Development server (no PWA)
npm run build            # Production build
npm run preview          # Test PWA locally
```

### Versioning

```bash
npm run release          # Auto-detect version bump
npm run release:patch    # Bump patch (0.0.X)
npm run release:minor    # Bump minor (0.X.0)
npm run release:major    # Bump major (X.0.0)
```

### Debugging

```bash
# In browser console:
navigator.serviceWorker.getRegistrations().then(r => console.log(r))
console.log(window.matchMedia('(display-mode: standalone)').matches)
console.log(import.meta.env.VITE_APP_VERSION)
```

---

## Troubleshooting

**Install prompt not showing:**

- Must be HTTPS in production
- User must visit twice, 5+ minutes apart
- Check DevTools → Application → Manifest

**Service worker not registering:**

- Use `npm run preview` (not `npm run dev`)
- Check console for errors
- Verify HTTPS in production

**Version not displaying:**

- Run `npm run build` again
- Check vite.config.ts has version injection code

---

**Estimated Time:** 3-4 hours
**Difficulty:** Intermediate
**Status:** Ready for implementation

**Last Updated:** 2025-12-23
**Version:** 1.0.0 (Haiku Optimized)
