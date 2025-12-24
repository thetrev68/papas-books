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
