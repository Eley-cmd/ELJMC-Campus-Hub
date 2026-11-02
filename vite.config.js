import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/*', 'pets/*'],
      manifest: {
        name: 'ELJMC Campus Hub', short_name: 'ELJMC Hub', description: 'The ELJMC campus community app',
        display: 'standalone', start_url: '/', background_color: '#f4f6fa', theme_color: '#1677ff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          // Cloudinary images: cache first, so photos stay visible on a poor connection
          { urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i, handler: 'CacheFirst',
            options: { cacheName: 'eljmc-images', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
        ],
      },
    }),
  ],
})
