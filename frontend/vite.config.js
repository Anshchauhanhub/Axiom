import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/goals': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
      '/quiz': 'http://localhost:8000',
      '/telegram': 'http://localhost:8000',
    }
  }
})
