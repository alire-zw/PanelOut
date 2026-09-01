import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const FRONTEND_PORT = 2344

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: FRONTEND_PORT,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: FRONTEND_PORT,
    strictPort: true,
    allowedHosts: true,
  },
})
