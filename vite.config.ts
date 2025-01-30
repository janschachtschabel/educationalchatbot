import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/edu-sharing': {
        target: 'https://redaktion.openeduhub.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/edu-sharing/, '/edu-sharing'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'WLO-KI-Editor');
          });
        }
      }
    }
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-utils': ['axios', 'zustand', '@supabase/supabase-js']
        }
      }
    }
  }
});