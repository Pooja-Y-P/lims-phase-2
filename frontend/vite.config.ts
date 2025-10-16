import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // This key '/api' now perfectly matches your backend prefix
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})