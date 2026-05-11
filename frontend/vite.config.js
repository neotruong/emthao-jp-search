import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Fail loudly if 5173 is already taken (e.g. orphan dev server) instead of silently
    // using 5174 — the silent fallback caused CORS + stale-HMR confusion in the past.
    strictPort: true,
    warmup: {
      clientFiles: ['./src/main.jsx', './src/App.jsx'],
    },
  },
})
