import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/data': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        // Enable proxying of all HTTP methods
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // No-op, just ensures all methods are proxied
          });
        },
      },
    },
  },
});
