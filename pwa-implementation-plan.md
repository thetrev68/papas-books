# PWA Implementation Plan - Papa's Books

## Overview

This plan provides detailed, step-by-step instructions for implementing Progressive Web App (PWA) functionality in Papa's Books. The goal is to enable "Add to Home Screen" functionality and ensure the app behaves like a native app on mobile devices.

**Target Audience:** Developers familiar with React/Vite/TypeScript
**Estimated Time:** 3-4 hours
**Prerequisites:** Node.js, npm, existing Papa's Books project running

## Phase 0: Automatic Versioning Setup

### Step 0.1: Install Versioning Dependencies

**Command to run:**

```bash
npm install -D standard-version
```

**What this does:**

- Installs `standard-version` for automatic semantic versioning
- Generates CHANGELOG.md automatically from conventional commits
- Updates package.json version on release

**Expected output:**

```text
+ standard-version@9.5.0
added 1 package, and audited X packages in Xs
```

### Step 0.2: Add Version Scripts to package.json

**Modify:** [package.json](package.json)

Add these scripts to the `"scripts"` section:

```json
{
  "scripts": {
    "release": "standard-version",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major",
    "release:patch": "standard-version --release-as patch"
  }
}
```

**Usage:**

- `npm run release` - Auto-detects version bump based on commits
- `npm run release:patch` - Force patch version (0.0.X)
- `npm run release:minor` - Force minor version (0.X.0)
- `npm run release:major` - Force major version (X.0.0)

### Step 0.3: Configure Version Management

**Create new file:** `.versionrc.json`

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

**What this does:**

- Configures which commit types appear in CHANGELOG
- Sets up conventional commit format
- Links commits to GitHub URLs

### Step 0.4: Add Version Display to App

**Modify:** [src/components/AppLayout.tsx](src/components/AppLayout.tsx)

Add version display to the desktop sidebar footer (after the Sign Out button):

```typescript
{/* Add this after the Sign Out button div */}
<div className="px-4 pb-2 text-center">
  <p className="text-xs text-neutral-400">
    v{import.meta.env.VITE_APP_VERSION || '0.1.0'}
  </p>
</div>
```

**Update:** [vite.config.ts](vite.config.ts)

Add environment variable for version:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Read version from package.json
import { readFileSync } from 'fs';
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

### Step 0.5: Commit Message Convention

From now on, use conventional commit format:

```text
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `chore:` - Maintenance (version bumps, deps)
- `docs:` - Documentation
- `refactor:` - Code restructuring
- `perf:` - Performance improvement
- `test:` - Testing

**Examples:**

```text
feat(pwa): add service worker registration
fix(auth): resolve token refresh issue
chore(deps): update vite to 7.3.0
```

**To create a release:**

```bash
git add .
git commit -m "feat(pwa): implement PWA infrastructure"
npm run release
git push --follow-tags origin main
```

This will:

1. Bump version in package.json
2. Generate/update CHANGELOG.md
3. Create a git tag
4. Commit the changes

## Phase 1: PWA Infrastructure Setup

### Step 1.1: Install Required Dependencies

**Command to run:**

```bash
npm install -D vite-plugin-pwa
```

**What this does:**

- Installs the Vite PWA plugin that automatically generates service workers and web manifests
- Handles PWA registration and updates
- Uses Workbox under the hood for service worker strategies

**Expected output:**

```text
+ vite-plugin-pwa@0.21.1
added 3 packages, and audited X packages in Xs
```

### Step 1.2: Create PWA Registration Module

**Create new file:** `src/pwa.ts`

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

**Why this approach:**

- Uses visibility change instead of interval (better performance)
- Properly typed BeforeInstallPromptEvent
- Checks for updates when user returns to tab
- Integrates with browser notifications if available

### Step 1.3: Update Main Application Entry Point

**Modify:** [src/main.tsx](src/main.tsx)

Add this import at the top (after `import './index.css';`):

```typescript
import './index.css';
import './pwa'; // Add PWA registration
```

**Complete change:**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './pwa'; // ADD THIS LINE
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// ... rest of imports remain the same
```

### Step 1.4: Configure Vite for PWA

**Modify:** [vite.config.ts](vite.config.ts)

Replace entire file with:

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

**Key configuration details:**

- `theme_color: '#0369a1'` - Matches brand-700 from existing Tailwind config
- `NetworkFirst` for Supabase API - ensures auth tokens stay fresh
- `CacheFirst` for fonts - improves performance
- Icons already exist in root directory (no need to move)
- Version injection for display in app

### Step 1.5: Update HTML Meta Tags

**Modify:** [index.html](index.html)

Replace with:

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

**Changes explained:**

- `viewport-fit=cover` - Ensures content fits under iPhone notches/Dynamic Island
- `theme-color: #0369a1` - Matches brand color (sky blue)
- `apple-mobile-web-app-capable` - Enables standalone mode on iOS
- `apple-mobile-web-app-status-bar-style: black-translucent` - Better iOS integration
- Manifest will be auto-generated by vite-plugin-pwa

### Step 1.6: Update Existing Manifest

**Delete:** `site.webmanifest` (will be auto-generated)

```bash
rm site.webmanifest
```

The vite-plugin-pwa will generate a complete manifest.webmanifest file automatically based on the config in vite.config.ts.

### Step 1.7: Optional - Create robots.txt

**Create new file:** `robots.txt` (in root directory)

```txt
# robots.txt
User-agent: *
Allow: /

# Disallow crawling of API endpoints
Disallow: /api/
```

**Note:** This is optional and only relevant if you plan to make the app publicly indexable.

## Phase 2: Mobile UI Optimization

### Step 2.1: Add Safe Area Support CSS

**Modify:** [src/index.css](src/index.css)

Replace with:

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

- Safe area insets for notch/Dynamic Island support
- Prevents iOS zoom on input focus
- Touch target size utilities
- Dynamic viewport height (dvh) for accurate mobile sizing
- Respects user's reduced motion preferences

### Step 2.2: Enhance AppLayout for PWA

**Modify:** [src/components/AppLayout.tsx](src/components/AppLayout.tsx)

Add PWA detection and update mobile header:

```typescript
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react'; // ADD THIS IMPORT

export default function AppLayout() {
  const { user, activeBookset, myBooksets, switchBookset, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ADD THIS: Detect if app is installed as PWA
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
    // ... existing navLinks array (no changes)
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

      {/* Desktop Sidebar - ADD version display */}
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

          {/* ADD THIS: Version display */}
          <div className="mt-2 text-center">
            <p className="text-xs text-neutral-400">
              v{import.meta.env.VITE_APP_VERSION || '0.1.0'}
            </p>
          </div>
        </div>
      </nav>

      {/* Main Content - UPDATED with safe area support */}
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

- Added PWA detection via `matchMedia` and `navigator.standalone`
- Applied `pt-safe` to mobile header when installed
- Added `.touch-target` to mobile nav for better accessibility
- Added version display in desktop sidebar
- All safe area classes now have proper CSS (added in Step 2.1)

### Step 2.3: Add PWA Installation Prompt Component

**Create new file:** `src/components/PWAInstallPrompt.tsx`

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

**Features:**

- Properly typed BeforeInstallPromptEvent
- 30-second delay for better user engagement
- Detects if already installed
- Responsive positioning
- Accessible with touch-target sizing
- Only shows if browser supports install prompt

### Step 2.4: Integrate Install Prompt into App

**Modify:** [src/components/AppLayout.tsx](src/components/AppLayout.tsx)

Add import at top:

```typescript
import PWAInstallPrompt from './PWAInstallPrompt'; // ADD THIS
```

Add component before closing `</div>` of main container (after the mobile nav):

```typescript
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden sticky bottom-0 bg-white border-t border-neutral-200 flex justify-around p-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
        {/* ... existing nav content ... */}
      </nav>

      {/* ADD THIS: PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}
```

## Phase 3: TypeScript Type Definitions

### Step 3.1: Add PWA Type Declarations

**Create new file:** `src/vite-env.d.ts`

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

**What this does:**

- Provides TypeScript support for vite-plugin-pwa virtual modules
- Defines types for environment variables
- Enables autocomplete for `import.meta.env.VITE_APP_VERSION`

## Phase 4: Testing & Validation

### Step 4.1: Build and Test Locally

**Commands to run:**

```bash
# Clean previous builds
rm -rf dist

# Build for production
npm run build

# Preview production build (required for PWA testing)
npm run preview
```

**Why preview mode:**

- Service workers only work in production builds
- Dev server (`npm run dev`) doesn't register service workers
- Preview serves the built app at <http://localhost:4173>

**Test checklist:**

1. Open <http://localhost:4173> in Chrome/Edge
2. Open DevTools → Application tab
3. Check "Manifest" section - should show Papa's Books details
4. Check "Service Workers" section - should show registered worker
5. Go offline (DevTools → Network → Offline)
6. Refresh page - app should still load (cached)
7. Go back online
8. Check for install prompt (may need to wait 30 seconds)

### Step 4.2: Chrome DevTools PWA Audit

1. Open <http://localhost:4173>
2. Open DevTools (F12)
3. Go to Lighthouse tab
4. Select "Progressive Web App" category
5. Click "Analyze page load"
6. Review score and fix any issues

**Target score:** 90+ for PWA category

**Common issues:**

- Missing HTTPS (required in production)
- Service worker not registered
- Manifest missing required fields
- Icons wrong size/format

### Step 4.3: Mobile Device Testing

**For Android (Chrome):**

1. Deploy to test server (must be HTTPS)
2. Visit URL on Android device
3. Look for "Add to Home screen" banner
4. Install app
5. Open from home screen
6. Verify standalone mode (no browser UI)
7. Test offline mode (airplane mode)

**For iOS (Safari):**

1. Deploy to test server (must be HTTPS)
2. Visit URL in Safari
3. Tap Share button
4. Look for "Add to Home Screen"
5. Install app
6. Open from home screen
7. Verify standalone mode
8. Check safe areas around notch/Dynamic Island

### Step 4.4: Version Update Testing

**Test the versioning workflow:**

```bash
# Make a change to any file
# Commit with conventional format
git add .
git commit -m "feat(pwa): add install prompt component"

# Create release
npm run release

# Check output
cat CHANGELOG.md
grep version package.json

# Push changes and tags
git push --follow-tags origin main
```

**Verify:**

- Version bumped in package.json
- CHANGELOG.md updated with commit
- Git tag created
- Version displays in app sidebar

## Phase 5: Production Deployment

### Step 5.1: Environment Variables

Ensure production environment has these variables:

```bash
VITE_SUPABASE_URL=your_production_url
VITE_SUPABASE_ANON_KEY=your_production_key
```

**Important:** Version is auto-injected from package.json, no env var needed.

### Step 5.2: Build for Production

```bash
npm run build
```

**Output:** `dist/` folder contains:

- Optimized JavaScript bundles
- Service worker files (sw.js, workbox-\*.js)
- manifest.webmanifest (auto-generated)
- Static assets (HTML, CSS, images)

### Step 5.3: Server Configuration

PWAs require HTTPS in production. Ensure your server:

1. **Serves over HTTPS** (use Let's Encrypt or hosting provider SSL)
2. **Serves service worker with correct headers**
3. **Handles SPA routing** (redirect all routes to index.html)

**Example nginx config:**

```nginx
server {
    listen 443 ssl http2;
    server_name papasbooks.com;

    # SSL certificates
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/papasbooks/dist;
    index index.html;

    # Service worker - no caching
    location ~ ^/(sw|workbox-.*)\.(js|js\.map)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files $uri =404;
    }

    # Manifest
    location = /manifest.webmanifest {
        add_header Cache-Control "public, max-age=86400"; # 1 day
        try_files $uri =404;
    }

    # Icons and static assets
    location ~* \.(ico|png|jpg|jpeg|svg|woff2)$ {
        add_header Cache-Control "public, max-age=31536000"; # 1 year
    }

    # SPA routing - redirect all routes to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Key points:**

- Service worker must NOT be cached (users won't get updates)
- Manifest can be cached for 1 day
- Static assets can be cached for 1 year (versioned by Vite)
- All routes fall back to index.html for client-side routing

### Step 5.4: Deploy and Verify

1. Upload `dist/` contents to server
2. Visit production URL on mobile device
3. Verify HTTPS (green lock icon)
4. Test install prompt
5. Install app
6. Test offline functionality
7. Run Lighthouse audit on production URL

## Phase 6: Maintenance & Updates

### Step 6.1: Releasing Updates

**Workflow:**

1. Make code changes
2. Commit with conventional format:

   ```bash
   git commit -m "feat(workbench): add bulk edit feature"
   ```

3. Create release:

   ```bash
   npm run release
   ```

4. Build and deploy:

   ```bash
   npm run build
   # Upload dist/ to server
   ```

5. Users get update notification on next visit
6. They refresh to get new version

### Step 6.2: Monitoring

**Check these regularly:**

- Service worker registration errors (console logs)
- Update adoption rate (analytics)
- Offline usage patterns
- Install/uninstall rates

**Browser DevTools:**

- Application → Service Workers → Check for updates
- Application → Storage → Clear site data (for testing)

### Step 6.3: Troubleshooting Common Issues

**Service Worker Not Updating:**

```bash
# Users may need to:
1. Close all tabs with the app
2. Wait 24 hours (browser SW update cycle)
3. Hard refresh (Ctrl+Shift+R)
4. Or: Unregister SW in DevTools
```

**Install Prompt Not Showing:**

- Must be HTTPS (production only)
- User must visit site twice, 5+ minutes apart
- User hasn't dismissed prompt 3+ times
- Site meets PWA criteria (manifest + SW)

**Offline Not Working:**

- Check service worker registered
- Check Workbox cache in DevTools → Application → Cache Storage
- Verify network requests in DevTools → Network tab

**Safe Areas Not Working (iOS):**

- Requires `viewport-fit=cover` in meta tag (Step 1.5)
- Only visible on devices with notches (iPhone X+)
- Test in iOS Simulator or real device

## Success Criteria

### Core PWA Features

- ✅ App installable on mobile home screen
- ✅ Opens in standalone mode (no browser UI)
- ✅ Service worker registered and caching assets
- ✅ Works offline for cached content
- ✅ Update notifications work
- ✅ Automatic versioning via conventional commits

### Mobile Experience

- ✅ Touch targets minimum 44x44px
- ✅ Forms don't zoom on focus (iOS)
- ✅ Safe areas respected on notched devices
- ✅ Smooth scrolling and navigation
- ✅ Install prompt appears after user engagement

### Performance

- ✅ Lighthouse PWA score > 90
- ✅ App loads quickly (cached assets)
- ✅ Service worker updates without breaking app
- ✅ Fonts cached for offline use
- ✅ Supabase API uses NetworkFirst (fresh auth)

### Developer Experience

- ✅ Version auto-updates in package.json
- ✅ CHANGELOG.md auto-generated
- ✅ Git tags created on release
- ✅ Version visible in app UI
- ✅ Conventional commit format enforced

## Appendix: Useful Commands

### Development

```bash
npm run dev              # Development server (no PWA)
npm run build            # Production build
npm run preview          # Test PWA locally (required!)
npm run lint             # Check code quality
npm run format           # Format code
```

### Versioning

```bash
npm run release          # Auto-detect version bump
npm run release:patch    # Bump patch version (0.0.X)
npm run release:minor    # Bump minor version (0.X.0)
npm run release:major    # Bump major version (X.0.0)
```

### Testing PWA

```bash
# Chrome DevTools → Application
- Manifest section (verify details)
- Service Workers section (verify registration)
- Storage → Cache Storage (verify assets cached)

# Lighthouse audit
- DevTools → Lighthouse → PWA category

# Test offline
- DevTools → Network → Offline checkbox
- Refresh page (should load from cache)
```

### Debugging

```bash
# Check SW registration in console
navigator.serviceWorker.getRegistrations().then(r => console.log(r))

# Check install prompt availability
window.addEventListener('beforeinstallprompt', e => console.log('Installable!'))

# Check display mode
console.log(window.matchMedia('(display-mode: standalone)').matches)

# Check version
console.log(import.meta.env.VITE_APP_VERSION)
```

## Additional Resources

- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [vite-plugin-pwa Documentation](https://vite-plugin-pwa.netlify.app/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Standard Version](https://github.com/conventional-changelog/standard-version)

---

**Estimated Total Time:** 3-4 hours
**Difficulty Level:** Intermediate
**Testing Required:** Local preview, mobile device, production

**Last Updated:** 2025-12-23
**Version:** 1.0.0
