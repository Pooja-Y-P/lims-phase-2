import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all addresses (required for Docker)
    port: 3000,
    watch: {
      usePolling: true, // Required for file watching in Docker on Windows/Mac
    },
    proxy: {
      // This key '/api' now perfectly matches your backend prefix
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})