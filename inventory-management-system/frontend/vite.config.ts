import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const usePolling =
  process.env.CHOKIDAR_USEPOLLING === 'true' || process.env.VITE_USE_POLLING === 'true'

const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
  ? Number(process.env.VITE_HMR_CLIENT_PORT)
  : undefined

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: usePolling ? { usePolling: true, interval: 1000 } : undefined,
    // When the SPA is reached via reverse proxy (e.g. nginx :80 → vite :3000)
    hmr: hmrClientPort
      ? { clientPort: hmrClientPort, protocol: 'ws' }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
    },
  },
})
