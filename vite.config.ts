// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.alquran\.cloud\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'quran-api-cache',
              expiration: { maxEntries: 114, maxAgeSeconds: 60 * 60 * 24 * 30 }, // Cache for 30 days
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: 'The Solo Hifz Partner',
        short_name: 'Hifz Partner',
        description: 'Minimalist Quran memorization testing PWA',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
});