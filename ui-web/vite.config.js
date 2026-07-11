import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    allowedHosts: ['dev.adrianrc.dev'],
    proxy: {
      '/api': 'http://api-core:5001',
      '/ai': 'http://ai-engine:5000'
    }
  }
})
