// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     host: true, // Listen on all addresses (required for Docker)
//     port: 3000,
//     watch: {
//       usePolling: true, // Required for file watching in Docker on Windows/Mac
//     },
//     proxy: {
//       '/api': {
//         target: process.env.VITE_API_BASE_URL,
//         changeOrigin: true,
//       },
//     }
    
//   },
// })


// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     host: true,
//     port: 3000,
//     proxy: {
//       '/api': {
//         target: 'http://localhost:8000', // 👈 backend local
//         changeOrigin: true,
//         secure: false,
//       },
//     },
//   },
// })



// frontend/vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // 👇 Load .env from project root
  const env = loadEnv(mode, path.resolve(__dirname, '..'))

  return {
    plugins: [react()],
    envDir: path.resolve(__dirname, '..'), // 👈 important
    server: {
      host: true,
      port: 3000,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL, // 👈 use loaded env
          changeOrigin: true,
        },
      },
    },
  }
})

