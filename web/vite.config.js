import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend so the frontend can use same-origin
    // relative URLs in both dev and a production build.
    proxy: {
      '/api': {
        // Override with API_PORT when 8000 is taken, so the backend can move
        // without editing this file.
        target: `http://127.0.0.1:${process.env.API_PORT ?? 8000}`,
        changeOrigin: true,
      },
    },
  },
})
