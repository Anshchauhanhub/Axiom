import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiUrl = process.env.API_URL || 'http://localhost:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': apiUrl,
      '/goals': apiUrl,
      '/users': apiUrl,
      '/quiz': apiUrl,
      '/telegram': apiUrl,
    }
  },
  preview: {
    proxy: {
      '/auth': apiUrl,
      '/goals': apiUrl,
      '/users': apiUrl,
      '/quiz': apiUrl,
      '/telegram': apiUrl,
    }
  }
})
