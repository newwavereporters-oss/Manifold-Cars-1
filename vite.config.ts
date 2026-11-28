import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'offline.html',
          'icons/icon-16.png',
          'icons/icon-24.png',
          'icons/icon-32.png',
          'icons/icon-48.png',
          'icons/icon-64.png',
          'icons/icon-72.png',
          'icons/icon-96.png',
          'icons/icon-120.png',
          'icons/icon-128.png',
          'icons/icon-144.png',
          'icons/icon-152.png',
          'icons/icon-180.png',
          'icons/icon-192.png',
          'icons/icon-256.png',
          'icons/icon-384.png',
          'icons/icon-512.png',
          'icons/maskable-icon-192.png',
          'icons/maskable-icon-512.png',
        ],
        manifest: {
          id: '/',
          name: 'MANIFOLD — Find · Verify · Drive',
          short_name: 'MANIFOLD',
          description:
            "Nigeria's premium car discovery and buying concierge. Verified cars with real video reviews, dealer storefronts, and 3D Lagos World.",
          theme_color: '#071A2B',
          background_color: '#040D16',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          categories: ['shopping', 'lifestyle', 'auto'],
          icons: [
            { src: '/icons/icon-48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icons/maskable-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/maskable-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: '/icons/splash-1280x720.png',
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide',
              label: 'MANIFOLD Automotive Concierge',
            },
            {
              src: '/icons/splash-1920x1080.png',
              sizes: '1920x1080',
              type: 'image/png',
              form_factor: 'wide',
              label: 'MANIFOLD Verified Inventory & 3D World',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
          globIgnores: ['assets/aistudio/**'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/offline\.html$/],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
